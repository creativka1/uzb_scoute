#!/usr/bin/env python3
"""Sync SofaScore public 2026 data through a normal browser session.

This uses the same public website session as scripts/sync_public_matchlists.py,
then requests public /api/v1 routes from that page. No RapidAPI key is used.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
from data_integrity import TOURNAMENTS, atomic_json, load, rebuild  # noqa: E402


def browser_fetch(page, route: str, allow_404: bool = False):
    result = page.evaluate(
        """async (route) => {
          const response = await fetch('/api/v1' + route, {
            credentials: 'include',
            headers: {
              'accept': 'application/json,text/plain,*/*',
              'x-requested-with': 'XMLHttpRequest'
            }
          });
          const text = await response.text();
          return {status: response.status, text};
        }""",
        route,
    )
    status = int(result["status"])
    if allow_404 and status == 404:
        return None
    if status != 200:
        raise RuntimeError(f"SofaScore browser API returned HTTP {status} for {route}")
    try:
        payload = json.loads(result["text"])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Non-JSON browser response for {route}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected browser response for {route}")
    return payload


def sync(max_requests=600, delay=0.45, league_filter="UZB", season_year=2026):
    league = league_filter or "UZB"
    if league not in TOURNAMENTS:
        raise RuntimeError(f"Unknown league: {league}")

    tournament_id = TOURNAMENTS[league]
    now = datetime.now(timezone.utc).isoformat()
    base = ROOT / "data/cache/seasons"
    calls = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="en-US",
            viewport={"width": 1365, "height": 900},
        )
        page = context.new_page()
        response = page.goto(
            "https://www.sofascore.com/",
            wait_until="domcontentloaded",
            timeout=60_000,
        )
        if response is None or response.status >= 400:
            browser.close()
            raise RuntimeError(
                f"SofaScore page unavailable: {None if response is None else response.status}"
            )
        page.wait_for_timeout(2500)

        def fetch(route, allow_404=False):
            nonlocal calls
            if calls >= max_requests:
                raise RuntimeError("Browser request budget exhausted; partial cache retained")
            calls += 1
            payload = browser_fetch(page, route, allow_404=allow_404)
            if delay:
                page.wait_for_timeout(int(delay * 1000))
            return payload

        seasons = fetch(f"/unique-tournament/{tournament_id}/seasons")
        rows = seasons.get("seasons")
        if not isinstance(rows, list):
            raise RuntimeError("Missing seasons list")
        season = next(
            (row for row in rows if str(row.get("year")) == str(season_year)),
            None,
        )
        if not season or not isinstance(season.get("id"), int):
            raise RuntimeError(f"Season {season_year} not found for {league}")
        season_id = season["id"]
        atomic_json(base / f"{league}_{tournament_id}_seasons.json", seasons)
        atomic_json(
            base / f"sync_{league}_{season_id}.json",
            {"complete": False, "attemptedAt": now, "source": "sofascore-browser-public"},
        )

        seen = set()
        finished = []
        pages = 0
        for page_index in range(100):
            payload = fetch(
                f"/unique-tournament/{tournament_id}/season/{season_id}/events/last/{page_index}"
            )
            events = payload.get("events")
            if not isinstance(events, list):
                raise RuntimeError(f"Missing events page {page_index}")
            for event in events:
                if not isinstance(event, dict) or not isinstance(event.get("id"), int):
                    raise RuntimeError("Invalid event")
                event_season = event.get("season") or {}
                unique = ((event.get("tournament") or {}).get("uniqueTournament") or {})
                if event_season.get("id") != season_id or unique.get("id") != tournament_id:
                    raise RuntimeError(f"Wrong competition/season for event {event.get('id')}")
            ids = {event["id"] for event in events}
            if ids and not (ids - seen):
                raise RuntimeError("Repeated event page")
            seen.update(ids)
            atomic_json(base / f"matches_{league}_{season_id}_p{page_index}.json", payload)
            pages += 1
            finished.extend(
                event for event in events
                if (event.get("status") or {}).get("type") == "finished"
            )
            if payload.get("hasNextPage") is not True:
                break
        else:
            raise RuntimeError("Pagination safety limit reached")

        downloaded = 0
        reused = 0
        unavailable = []
        for event in sorted(finished, key=lambda item: item.get("startTimestamp", 0)):
            event_id = event["id"]
            target = ROOT / f"data/cache/lineups/{event_id}.json"
            cached = load(target, {}) or {}
            if cached.get("confirmed") is True and all(
                isinstance((cached.get(side) or {}).get("players"), list)
                and (cached.get(side) or {}).get("players")
                for side in ("home", "away")
            ):
                reused += 1
                continue

            lineup = fetch(f"/event/{event_id}/lineups", allow_404=True)
            if lineup is None:
                unavailable.append(event_id)
                continue
            valid = lineup.get("confirmed") is True and all(
                isinstance((lineup.get(side) or {}).get("players"), list)
                and (lineup.get(side) or {}).get("players")
                for side in ("home", "away")
            )
            if not valid:
                unavailable.append(event_id)
                continue

            lineup["_source"] = "sofascore-browser-public"
            lineup["_cachedAt"] = time.time()
            atomic_json(target, lineup)
            downloaded += 1

        browser.close()

    linked = 0
    for event in finished:
        cached = load(ROOT / f"data/cache/lineups/{event['id']}.json", {}) or {}
        if cached.get("confirmed") is True:
            linked += 1

    complete = linked == len(finished)
    atomic_json(
        base / f"sync_{league}_{season_id}.json",
        {
            "complete": complete,
            "lastSyncedAt": now,
            "pages": pages,
            "source": "sofascore-browser-public",
            "finishedMatches": len(finished),
            "lineupsCached": linked,
            "lineupsDownloadedThisRun": downloaded,
            "lineupsReused": reused,
            "lineupsUnavailable": unavailable,
            "requestsMade": calls,
        },
    )

    report = rebuild(ROOT)
    audit = {
        "status": "success" if complete else "partial",
        "updatedAt": now,
        "provider": "sofascore-browser-public",
        "league": league,
        "seasonYear": season_year,
        "seasonId": season_id,
        "requestsMade": calls,
        "finishedMatches": len(finished),
        "lineupsCached": linked,
        "downloadedThisRun": downloaded,
        "reused": reused,
        "unavailable": len(unavailable),
        "complete": complete,
        "linkedLineups": report.get("linkedLineups"),
    }
    atomic_json(ROOT / "data/audits/statistics_sync_status.json", audit)
    print(audit)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-requests", type=int, default=600)
    parser.add_argument("--delay", type=float, default=0.45)
    parser.add_argument("--league", choices=sorted(TOURNAMENTS), default="UZB")
    parser.add_argument("--season-year", type=int, default=2026)
    args = parser.parse_args()
    try:
        sync(
            max(10, args.max_requests),
            max(0.1, args.delay),
            args.league,
            args.season_year,
        )
    except Exception as error:
        atomic_json(
            ROOT / "data/audits/statistics_sync_status.json",
            {
                "status": "failed",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "provider": "sofascore-browser-public",
                "league": args.league,
                "seasonYear": args.season_year,
                "error": str(error),
            },
        )
        raise
