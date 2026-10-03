#!/usr/bin/env python3
"""Fetch public SofaScore match lists through a normal browser session.

This fallback is intentionally limited to public season/match-list data:
teams, dates, scores and event IDs. It does not attempt to bypass access
controls or fetch player lineups/statistics. Those remain a separate sync step.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TOURNAMENTS = {"UZB": 772, "KAZ": 682}


def atomic_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(text, encoding="utf-8")
    temp.replace(path)


def fetch_json(page, route: str):
    """Fetch a public /api/v1 route from the already-open SofaScore page."""
    result = page.evaluate(
        """async (route) => {
          const response = await fetch('/api/v1' + route, {
            credentials: 'include',
            headers: {'accept': 'application/json'}
          });
          const text = await response.text();
          return {status: response.status, text};
        }""",
        route,
    )
    status = int(result["status"])
    if status != 200:
        raise RuntimeError(f"Public API returned HTTP {status} for {route}")
    try:
        payload = json.loads(result["text"])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Non-JSON public response for {route}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected public response for {route}")
    return payload


def season_for_year(page, tournament_id: int, year: int):
    payload = fetch_json(page, f"/unique-tournament/{tournament_id}/seasons")
    seasons = payload.get("seasons")
    if not isinstance(seasons, list):
        raise RuntimeError(f"Missing seasons for tournament {tournament_id}")
    for season in seasons:
        if str(season.get("year")) == str(year):
            return season
    raise RuntimeError(f"Season {year} not found for tournament {tournament_id}")


def validate_event(event, tournament_id: int, season_id: int):
    if not isinstance(event, dict) or not isinstance(event.get("id"), int):
        raise RuntimeError("Invalid event payload")
    season = event.get("season") or {}
    unique = ((event.get("tournament") or {}).get("uniqueTournament") or {})
    if season.get("id") != season_id or unique.get("id") != tournament_id:
        raise RuntimeError(
            f"Wrong competition/season for event {event.get('id')}: "
            f"{unique.get('id')}/{season.get('id')}"
        )


def fetch_last_pages(page, league: str, tournament_id: int, season: dict, delay: float):
    season_id = int(season["id"])
    seen = set()
    pages = []
    for page_index in range(100):
        route = (
            f"/unique-tournament/{tournament_id}/season/{season_id}"
            f"/events/last/{page_index}"
        )
        payload = fetch_json(page, route)
        events = payload.get("events")
        if not isinstance(events, list):
            raise RuntimeError(f"Missing events list for {league}/{season_id}/{page_index}")
        for event in events:
            validate_event(event, tournament_id, season_id)
        ids = {event["id"] for event in events}
        if ids and not (ids - seen):
            raise RuntimeError(f"Repeated event page for {league}/{season_id}")
        seen.update(ids)
        pages.append(payload)
        if payload.get("hasNextPage") is not True:
            return pages
        time.sleep(delay)
    raise RuntimeError(f"Pagination limit reached for {league}/{season_id}")


def sync(year: int, leagues: list[str], delay: float):
    now = datetime.now(timezone.utc).isoformat()
    base = ROOT / "data/cache/seasons"
    status = {
        "status": "running",
        "updatedAt": now,
        "source": "public-browser-match-list",
        "seasonYear": year,
        "leagues": {},
    }
    atomic_json(ROOT / "data/audits/public_matchlist_sync_status.json", status)

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
                f"SofaScore public page unavailable: "
                f"{None if response is None else response.status}"
            )
        page.wait_for_timeout(2500)

        for league in leagues:
            tournament_id = TOURNAMENTS[league]
            season = season_for_year(page, tournament_id, year)
            season_id = int(season["id"])
            # Keep the source season list contract used by data_integrity.py.
            seasons_payload = fetch_json(
                page, f"/unique-tournament/{tournament_id}/seasons"
            )
            atomic_json(base / f"{league}_{tournament_id}_seasons.json", seasons_payload)

            pages = fetch_last_pages(page, league, tournament_id, season, delay)
            for index, payload in enumerate(pages):
                atomic_json(base / f"matches_{league}_{season_id}_p{index}.json", payload)

            atomic_json(
                base / f"sync_{league}_{season_id}.json",
                {
                    "complete": True,
                    "lastSyncedAt": now,
                    "pages": len(pages),
                    "matchListOnly": True,
                    "source": "public-browser-match-list",
                },
            )
            event_ids = {
                event["id"]
                for payload in pages
                for event in payload.get("events", [])
                if isinstance(event, dict) and isinstance(event.get("id"), int)
            }
            status["leagues"][league] = {
                "seasonId": season_id,
                "seasonName": season.get("name"),
                "pages": len(pages),
                "events": len(event_ids),
            }
            atomic_json(ROOT / "data/audits/public_matchlist_sync_status.json", status)

        browser.close()

    status["status"] = "success"
    status["updatedAt"] = datetime.now(timezone.utc).isoformat()
    atomic_json(ROOT / "data/audits/public_matchlist_sync_status.json", status)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--season-year", type=int, default=2026)
    parser.add_argument(
        "--league",
        action="append",
        choices=sorted(TOURNAMENTS),
        help="Repeat for specific leagues; default is both",
    )
    parser.add_argument("--delay", type=float, default=0.6)
    args = parser.parse_args()
    leagues = args.league or sorted(TOURNAMENTS)
    try:
        sync(args.season_year, leagues, max(0.0, args.delay))
    except Exception as error:
        atomic_json(
            ROOT / "data/audits/public_matchlist_sync_status.json",
            {
                "status": "failed",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "source": "public-browser-match-list",
                "seasonYear": args.season_year,
                "error": str(error),
            },
        )
        raise
