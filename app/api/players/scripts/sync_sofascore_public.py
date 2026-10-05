#!/usr/bin/env python3
"""Sync public SofaScore match lists and player match statistics.

No RapidAPI or paid provider is used. The script only requests public
SofaScore API routes from the normal website origin, keeps a conservative
delay, caches completed matches, and resumes from existing files.
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
from data_integrity import TOURNAMENTS, atomic_json, load, rebuild  # noqa: E402

BASE = "https://www.sofascore.com/api/v1"
RETRYABLE = {429, 500, 502, 503, 504}


def sync(max_requests=600, delay=0.45, league_filter="UZB", season_year=2026):
    session = requests.Session(impersonate="chrome120")
    headers = {
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.sofascore.com/",
        "Origin": "https://www.sofascore.com",
    }
    calls = 0

    def fetch(route):
        nonlocal calls
        for attempt in range(3):
            if calls >= max_requests:
                raise RuntimeError("Public SofaScore request budget exhausted; cache retained")
            calls += 1
            response = session.get(BASE + route, headers=headers, timeout=30)
            if response.status_code == 200:
                payload = response.json()
                if not isinstance(payload, dict):
                    raise RuntimeError(f"Unexpected public response for {route}")
                if delay:
                    time.sleep(delay)
                return payload
            if response.status_code in {401, 403}:
                raise RuntimeError(
                    f"Public SofaScore route unavailable: HTTP {response.status_code} for {route}"
                )
            if response.status_code not in RETRYABLE:
                raise RuntimeError(
                    f"Public SofaScore request failed: HTTP {response.status_code} for {route}"
                )
            time.sleep(min(12, 2 * (attempt + 1)))
        raise RuntimeError(f"Public SofaScore retry limit reached for {route}")

    league = league_filter or "UZB"
    if league not in TOURNAMENTS:
        raise RuntimeError(f"Unknown league: {league}")

    now = datetime.now(timezone.utc).isoformat()
    tournament_id = TOURNAMENTS[league]
    base = ROOT / "data/cache/seasons"

    seasons = fetch(f"/unique-tournament/{tournament_id}/seasons")
    rows = seasons.get("seasons")
    if not isinstance(rows, list):
        raise RuntimeError("SofaScore seasons response has no seasons list")
    season = next(
        (row for row in rows if str(row.get("year")) == str(season_year)),
        None,
    )
    if not season or not isinstance(season.get("id"), int):
        raise RuntimeError(f"Season {season_year} not found for {league}")
    season_id = season["id"]
    atomic_json(base / f"{league}_{tournament_id}_seasons.json", seasons)

    # Invalidate completeness before downloading. A failed run must never leave
    # a partial refresh marked as complete.
    atomic_json(
        base / f"sync_{league}_{season_id}.json",
        {
            "complete": False,
            "attemptedAt": now,
            "source": "sofascore-public",
        },
    )

    seen = set()
    pages = 0
    finished_events = []
    for page_index in range(100):
        payload = fetch(
            f"/unique-tournament/{tournament_id}/season/{season_id}/events/last/{page_index}"
        )
        events = payload.get("events")
        if not isinstance(events, list):
            raise RuntimeError(f"Missing events for {league}/{season_id}/page {page_index}")

        for event in events:
            if not isinstance(event, dict) or not isinstance(event.get("id"), int):
                raise RuntimeError("Invalid event payload")
            event_season = event.get("season") or {}
            unique = ((event.get("tournament") or {}).get("uniqueTournament") or {})
            if event_season.get("id") != season_id or unique.get("id") != tournament_id:
                raise RuntimeError(
                    f"Wrong competition/season for event {event.get('id')}"
                )

        ids = {event["id"] for event in events}
        if ids and not (ids - seen):
            raise RuntimeError("Public SofaScore repeated an event page")
        seen.update(ids)
        atomic_json(base / f"matches_{league}_{season_id}_p{page_index}.json", payload)
        pages += 1

        finished_events.extend(
            event for event in events
            if (event.get("status") or {}).get("type") == "finished"
        )
        if payload.get("hasNextPage") is not True:
            break
    else:
        raise RuntimeError("Public SofaScore pagination safety limit reached")

    downloaded = 0
    reused = 0
    unavailable = []
    for event in sorted(finished_events, key=lambda row: row.get("startTimestamp", 0)):
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

        try:
            lineup = fetch(f"/event/{event_id}/lineups")
        except RuntimeError as error:
            # 404/no-lineup is data unavailability, but access/quota/network
            # failures must abort so the audit cannot claim a clean sync.
            if "HTTP 404" in str(error):
                unavailable.append(event_id)
                continue
            raise

        valid = lineup.get("confirmed") is True and all(
            isinstance((lineup.get(side) or {}).get("players"), list)
            and (lineup.get(side) or {}).get("players")
            for side in ("home", "away")
        )
        if not valid:
            unavailable.append(event_id)
            continue
        lineup["_source"] = "sofascore-public"
        lineup["_cachedAt"] = time.time()
        atomic_json(target, lineup)
        downloaded += 1

    linked = 0
    for event in finished_events:
        cached = load(ROOT / f"data/cache/lineups/{event['id']}.json", {}) or {}
        if cached.get("confirmed") is True:
            linked += 1

    complete = linked == len(finished_events)
    manifest = {
        "complete": complete,
        "lastSyncedAt": now,
        "pages": pages,
        "source": "sofascore-public",
        "finishedMatches": len(finished_events),
        "lineupsCached": linked,
        "lineupsDownloadedThisRun": downloaded,
        "lineupsReused": reused,
        "lineupsUnavailable": unavailable,
        "requestsMade": calls,
    }
    atomic_json(base / f"sync_{league}_{season_id}.json", manifest)

    report = rebuild(ROOT)
    audit = {
        "status": "success" if complete else "partial",
        "updatedAt": now,
        "provider": "sofascore-public",
        "league": league,
        "seasonYear": season_year,
        "seasonId": season_id,
        "requestsMade": calls,
        "finishedMatches": len(finished_events),
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
                "provider": "sofascore-public",
                "league": args.league,
                "seasonYear": args.season_year,
                "error": str(error),
            },
        )
        raise
