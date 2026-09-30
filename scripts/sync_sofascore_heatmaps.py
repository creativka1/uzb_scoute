#!/usr/bin/env python3
"""
Incrementally cache SofaScore player heatmaps for Uzbekistan Superliga through
the RapidAPI integration.

The script is deliberately slow and quota-friendly:
- only confirmed cached lineups are used;
- only matches marked by SofaScore as having player heatmaps are considered;
- already cached heatmaps are never requested again;
- a small maximum number of requests is made per run;
- 429 responses stop the batch after retries instead of hammering the API.

Successful source payloads are stored as:
  data/cache/heatmaps/<eventId>_<playerId>.json

No position is invented here. The separate detailed-position builder consumes
these source heatmaps as supporting evidence.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
HEATMAP_DIR = ROOT / "data" / "cache" / "heatmaps"
STATUS_FILE = ROOT / "data" / "audits" / "heatmap_sync_status.json"
HOST = "sofascore.p.rapidapi.com"
ENDPOINT = f"https://{HOST}/matches/get-player-heatmap"


def valid_points(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    rows = payload.get("heatmap")
    if not isinstance(rows, list):
        return []
    return [
        p for p in rows
        if isinstance(p, dict)
        and isinstance(p.get("x"), (int, float))
        and isinstance(p.get("y"), (int, float))
    ]


def cached_events() -> list[dict[str, Any]]:
    events: dict[int, dict[str, Any]] = {}
    for filename in glob.glob(str(ROOT / "data/cache/seasons/matches_UZB_*.json")):
        try:
            payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        except Exception:
            continue

        for event in payload.get("events", payload.get("matches", [])):
            if not isinstance(event, dict):
                continue
            if event.get("status", {}).get("type") != "finished":
                continue
            if event.get("hasEventPlayerHeatMap") is not True:
                continue
            event_id = event.get("id")
            if isinstance(event_id, int):
                events[event_id] = event

    return sorted(
        events.values(),
        key=lambda e: int(e.get("startTimestamp") or 0),
        reverse=True,
    )


def lineup_for(event_id: int) -> dict[str, Any] | None:
    path = ROOT / "data" / "cache" / "lineups" / f"{event_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def candidate_starters(event: dict[str, Any], lineup: dict[str, Any]):
    event_id = int(event["id"])
    for side_name in ("home", "away"):
        side = lineup.get(side_name)
        if not isinstance(side, dict):
            continue
        team_name = (event.get("homeTeam") if side_name == "home" else event.get("awayTeam") or {})
        if not isinstance(team_name, dict):
            team_name = {}

        for item in side.get("players", []):
            if not isinstance(item, dict) or item.get("substitute") is True:
                continue
            player = item.get("player") or {}
            player_id = player.get("id")
            broad_position = item.get("position") or player.get("position")
            if not isinstance(player_id, int) or broad_position == "G":
                continue
            yield {
                "eventId": event_id,
                "playerId": player_id,
                "player": player.get("name"),
                "team": team_name.get("name"),
                "broadPosition": broad_position,
            }


def fetch_heatmap(session, headers, event_id: int, player_id: int):
    for attempt in range(3):
        response = session.get(
            ENDPOINT,
            headers=headers,
            params={"matchId": event_id, "playerId": player_id},
            timeout=30,
        )

        if response.status_code == 200:
            try:
                return 200, response.json(), False
            except Exception:
                return 200, None, False

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            try:
                wait = float(retry_after) if retry_after else 15.0 * (attempt + 1)
            except Exception:
                wait = 15.0 * (attempt + 1)
            wait = max(10.0, min(wait, 60.0))
            print(f"[RATE LIMIT] 429; waiting {wait:.0f}s")
            time.sleep(wait)
            continue

        return response.status_code, None, False

    return 429, None, True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-requests", type=int, default=12)
    parser.add_argument("--delay", type=float, default=8.0)
    args = parser.parse_args()

    api_key = os.environ.get("RAPIDAPI_KEY", "").strip()
    if not api_key:
        raise RuntimeError("RAPIDAPI_KEY is not configured.")

    HEATMAP_DIR.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)

    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": HOST,
        "Accept": "application/json",
    }
    session = requests.Session(impersonate="chrome120")

    requests_made = 0
    saved = 0
    empty = 0
    rate_limited = False
    checked_candidates = 0
    saved_rows: list[dict[str, Any]] = []

    for event in cached_events():
        lineup = lineup_for(int(event["id"]))
        if not lineup or lineup.get("confirmed") is not True:
            continue

        for row in candidate_starters(event, lineup):
            checked_candidates += 1
            target = HEATMAP_DIR / f"{row['eventId']}_{row['playerId']}.json"
            if target.exists():
                continue
            if requests_made >= args.max_requests:
                break

            status, payload, exhausted = fetch_heatmap(
                session,
                headers,
                row["eventId"],
                row["playerId"],
            )
            requests_made += 1

            points = valid_points(payload)
            print(
                f"{row['eventId']} | {row['player']} | "
                f"status={status} points={len(points)}"
            )

            if status == 200 and points:
                # Store the source payload exactly as returned.
                target.write_text(
                    json.dumps(payload, ensure_ascii=False),
                    encoding="utf-8",
                )
                saved += 1
                saved_rows.append({
                    **row,
                    "points": len(points),
                    "medianX": sorted(float(p["x"]) for p in points)[len(points) // 2],
                    "medianY": sorted(float(p["y"]) for p in points)[len(points) // 2],
                })
            elif status == 200:
                empty += 1

            if exhausted:
                rate_limited = True
                break

            time.sleep(max(0.0, args.delay))

        if requests_made >= args.max_requests or rate_limited:
            break

    total_cached = len(list(HEATMAP_DIR.glob("[0-9]*_[0-9]*.json")))
    status_payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "requestsMadeThisRun": requests_made,
        "heatmapsSavedThisRun": saved,
        "emptyResponsesThisRun": empty,
        "rateLimited": rate_limited,
        "totalCachedHeatmaps": total_cached,
        "savedSamples": saved_rows,
    }
    STATUS_FILE.write_text(
        json.dumps(status_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("\n=== HEATMAP SYNC ===")
    print(json.dumps(status_payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
