#!/usr/bin/env python3
"""
Probe SofaScore player heatmaps through the existing RapidAPI provider.

Requires:
  RAPIDAPI_KEY environment variable

This script does not modify the scouting dataset or assign detailed positions.
It only checks whether match/player heatmap coordinates are returned.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import time
from pathlib import Path
from typing import Any

from curl_cffi import requests

HOST = "sofascore.p.rapidapi.com"
ENDPOINT = f"https://{HOST}/matches/get-player-heatmap"
ROOT = Path(__file__).resolve().parents[1]


def recent_uzb_events(limit: int) -> list[dict[str, Any]]:
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
    )[:limit]


def load_lineup(event_id: int) -> dict[str, Any] | None:
    path = ROOT / "data/cache/lineups" / f"{event_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def sample_outfield_starters(lineup: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    players: list[dict[str, Any]] = []

    for broad_position in ("D", "M", "F"):
        for side in ("home", "away"):
            for item in (lineup.get(side) or {}).get("players", []):
                if item.get("substitute") is True:
                    continue

                player = item.get("player") or {}
                position = item.get("position") or player.get("position")
                player_id = player.get("id")

                if position != broad_position or not isinstance(player_id, int):
                    continue

                players.append(
                    {
                        "playerId": player_id,
                        "player": player.get("name"),
                        "position": position,
                    }
                )
                break

            if len(players) >= limit:
                return players

    return players[:limit]


def valid_heatmap_points(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []

    rows = payload.get("heatmap")
    if not isinstance(rows, list):
        return []

    return [
        point
        for point in rows
        if isinstance(point, dict)
        and isinstance(point.get("x"), (int, float))
        and isinstance(point.get("y"), (int, float))
    ]


def fetch_heatmap(session, headers, match_id: int, player_id: int):
    last_status = None
    for attempt in range(4):
        response = session.get(
            ENDPOINT,
            headers=headers,
            params={"matchId": match_id, "playerId": player_id},
            timeout=30,
        )
        last_status = response.status_code

        if response.status_code == 200:
            return response.status_code, response.json()

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            try:
                wait = max(2.0, float(retry_after)) if retry_after else 3.0 * (attempt + 1)
            except Exception:
                wait = 3.0 * (attempt + 1)
            time.sleep(wait)
            continue

        return response.status_code, None

    return last_status or 0, None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matches", type=int, default=10)
    parser.add_argument("--players-per-match", type=int, default=3)
    parser.add_argument(
        "--output",
        default="data/audits/rapidapi_sofascore_heatmap_probe.json",
    )
    args = parser.parse_args()

    api_key = os.environ.get("RAPIDAPI_KEY")
    if not api_key:
        raise RuntimeError(
            "RAPIDAPI_KEY is not configured. Add it as a GitHub Actions secret "
            "or environment variable before running this probe."
        )

    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": HOST,
        "Accept": "application/json",
    }

    session = requests.Session(impersonate="chrome120")
    events = recent_uzb_events(args.matches)

    checked = 0
    successful = 0
    total_points = 0
    samples: list[dict[str, Any]] = []

    for event in events:
        lineup = load_lineup(event["id"])
        if not lineup:
            continue

        for player in sample_outfield_starters(lineup, args.players_per_match):
            checked += 1

            try:
                status, payload = fetch_heatmap(
                    session,
                    headers,
                    event["id"],
                    player["playerId"],
                )
                points = valid_heatmap_points(payload)

                row = {
                    "eventId": event["id"],
                    "playerId": player["playerId"],
                    "player": player["player"],
                    "broadPosition": player["position"],
                    "httpStatus": status,
                    "heatmapPoints": len(points),
                }

                if points:
                    successful += 1
                    total_points += len(points)
                    row["meanX"] = round(
                        sum(float(point["x"]) for point in points) / len(points), 2
                    )
                    row["meanY"] = round(
                        sum(float(point["y"]) for point in points) / len(points), 2
                    )

                samples.append(row)
                print(
                    f"{event['id']} | {player['player']} "
                    f"status={status} points={len(points)}"
                )
            except Exception as exc:
                samples.append(
                    {
                        "eventId": event["id"],
                        "playerId": player["playerId"],
                        "player": player["player"],
                        "broadPosition": player["position"],
                        "error": str(exc),
                        "heatmapPoints": 0,
                    }
                )

            time.sleep(1.5)

    report = {
        "source": "SofaScore via RapidAPI",
        "endpoint": "matches/get-player-heatmap",
        "playersChecked": checked,
        "playersWithHeatmap": successful,
        "coveragePercent": round(successful / checked * 100.0, 1) if checked else 0.0,
        "totalHeatmapPoints": total_points,
        "samples": samples,
    }

    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(
        {
            "playersChecked": checked,
            "playersWithHeatmap": successful,
            "coveragePercent": report["coveragePercent"],
            "totalHeatmapPoints": total_points,
        },
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()
