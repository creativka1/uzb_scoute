#!/usr/bin/env python3
"""
Audit whether SofaScore has enough spatial data for detailed player positions
in Uzbekistan Superliga.

The audit does NOT assign LB/RB/DM/CM/AM/LW/RW/ST to any player.
It only measures coverage of:
- lineups + formation
- average positions
- player heatmaps

It uses the UZB match cache already committed in the repo so we do not invent
or guess event IDs.

Output:
  data/audits/sofascore_position_coverage.json
"""

from __future__ import annotations

import argparse
import glob
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from curl_cffi import requests

BASE = "https://api.sofascore.com/api/v1"
SESSION = requests.Session(impersonate="chrome120")


def fetch_json(path: str, retries: int = 3) -> Any:
    url = f"{BASE}/{path.lstrip('/')}"
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = SESSION.get(
                url,
                headers={
                    "Accept": "application/json,text/plain,*/*",
                    "Referer": "https://www.sofascore.com/",
                },
                timeout=30,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"Failed GET {url}: {last_error}")


def cached_uzb_events() -> list[dict[str, Any]]:
    events: dict[str, dict[str, Any]] = {}
    for filename in glob.glob("data/cache/seasons/matches_UZB_*.json"):
        try:
            payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        except Exception:
            continue
        rows = payload.get("events") or payload.get("matches") or []
        for event in rows:
            if not isinstance(event, dict):
                continue
            if event.get("status", {}).get("type") != "finished":
                continue
            event_id = event.get("id")
            if event_id is None:
                continue
            events[str(event_id)] = event
    return sorted(
        events.values(),
        key=lambda e: int(e.get("startTimestamp") or 0),
        reverse=True,
    )


def side_players(lineups: dict[str, Any], side: str) -> list[dict[str, Any]]:
    obj = lineups.get(side)
    if not isinstance(obj, dict):
        return []
    players = obj.get("players")
    return [p for p in players if isinstance(p, dict)] if isinstance(players, list) else []


def starter_rows(lineups: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for side in ("home", "away"):
        for item in side_players(lineups, side):
            # SofaScore uses substitute=false for starters in match lineups.
            if item.get("substitute") is True:
                continue
            player = item.get("player") or {}
            pid = player.get("id")
            if pid is None:
                continue
            result.append(
                {
                    "side": side,
                    "playerId": int(pid),
                    "name": player.get("name"),
                    "broadPosition": item.get("position") or player.get("position"),
                    "minutesPlayed": (item.get("statistics") or {}).get("minutesPlayed"),
                }
            )
    return result


def normalize_average_positions(payload: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not isinstance(payload, dict):
        return rows

    for side in ("home", "away"):
        side_rows = payload.get(side)
        if not isinstance(side_rows, list):
            continue
        for item in side_rows:
            if not isinstance(item, dict):
                continue
            player = item.get("player") or {}
            pid = player.get("id")
            # Common SofaScore shape exposes averageX/averageY.
            x = item.get("averageX")
            y = item.get("averageY")
            if x is None:
                x = item.get("x")
            if y is None:
                y = item.get("y")
            if pid is None or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                continue
            rows.append(
                {
                    "side": side,
                    "playerId": int(pid),
                    "name": player.get("name"),
                    "x": float(x),
                    "y": float(y),
                }
            )
    return rows


def choose_heatmap_sample(starters: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Prefer outfield players and spread sample across broad D/M/F groups."""
    chosen: list[dict[str, Any]] = []
    for code in ("D", "M", "F"):
        for row in starters:
            if row.get("broadPosition") == code and row not in chosen:
                chosen.append(row)
                if len(chosen) >= limit:
                    return chosen
    for row in starters:
        if row.get("broadPosition") != "G" and row not in chosen:
            chosen.append(row)
            if len(chosen) >= limit:
                break
    return chosen


def pct(num: int, den: int) -> float:
    return round((num / den * 100.0), 1) if den else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matches", type=int, default=30)
    parser.add_argument("--heatmaps-per-match", type=int, default=4)
    parser.add_argument(
        "--output",
        default="data/audits/sofascore_position_coverage.json",
    )
    args = parser.parse_args()

    events = cached_uzb_events()[: args.matches]
    if not events:
        raise RuntimeError("No cached finished UZB events found in data/cache/seasons.")

    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    total_starters = 0
    total_avg_positions = 0
    heatmap_requests = 0
    heatmap_success = 0
    heatmap_points = 0
    broad_position_counts: dict[str, int] = {}

    for index, event in enumerate(events, start=1):
        event_id = int(event["id"])
        home = (event.get("homeTeam") or {}).get("name", "?")
        away = (event.get("awayTeam") or {}).get("name", "?")

        row: dict[str, Any] = {
            "eventId": event_id,
            "match": f"{home} vs {away}",
            "lineups": False,
            "formations": {"home": None, "away": None},
            "starters": 0,
            "averagePositions": 0,
            "heatmapsChecked": 0,
            "heatmapsAvailable": 0,
            "heatmapPoints": 0,
        }

        try:
            lineups = fetch_json(f"event/{event_id}/lineups")
            home_players = side_players(lineups, "home")
            away_players = side_players(lineups, "away")
            row["lineups"] = bool(home_players and away_players)
            row["formations"] = {
                "home": (lineups.get("home") or {}).get("formation"),
                "away": (lineups.get("away") or {}).get("formation"),
            }

            starters = starter_rows(lineups)
            row["starters"] = len(starters)
            total_starters += len(starters)

            for starter in starters:
                code = str(starter.get("broadPosition") or "?")
                broad_position_counts[code] = broad_position_counts.get(code, 0) + 1

            try:
                avg_payload = fetch_json(f"event/{event_id}/average-positions")
                avg_rows = normalize_average_positions(avg_payload)
                starter_ids = {s["playerId"] for s in starters}
                avg_starters = [p for p in avg_rows if p["playerId"] in starter_ids]
                row["averagePositions"] = len(avg_starters)
                total_avg_positions += len(avg_starters)
            except Exception as exc:
                row["averagePositionsError"] = str(exc)

            for starter in choose_heatmap_sample(starters, args.heatmaps_per_match):
                heatmap_requests += 1
                row["heatmapsChecked"] += 1
                try:
                    hm = fetch_json(
                        f"event/{event_id}/player/{starter['playerId']}/heatmap"
                    )
                    points = hm.get("heatmap") if isinstance(hm, dict) else None
                    if isinstance(points, list) and points:
                        valid_points = [
                            p
                            for p in points
                            if isinstance(p, dict)
                            and isinstance(p.get("x"), (int, float))
                            and isinstance(p.get("y"), (int, float))
                        ]
                        if valid_points:
                            heatmap_success += 1
                            row["heatmapsAvailable"] += 1
                            heatmap_points += len(valid_points)
                            row["heatmapPoints"] += len(valid_points)
                except Exception:
                    pass
                time.sleep(0.05)

            print(
                f"[{index:02d}/{len(events)}] {row['match']}: "
                f"lineups={row['lineups']} formations={row['formations']} "
                f"starters={row['starters']} avg={row['averagePositions']} "
                f"heatmaps={row['heatmapsAvailable']}/{row['heatmapsChecked']}"
            )
            results.append(row)
        except Exception as exc:
            errors.append({"eventId": event_id, "match": row["match"], "error": str(exc)})
            print(f"[{index:02d}/{len(events)}] ERROR {event_id}: {exc}")

        time.sleep(0.1)

    analyzed = len(results)
    lineup_matches = sum(1 for r in results if r["lineups"])
    both_formations = sum(
        1
        for r in results
        if r["formations"].get("home") and r["formations"].get("away")
    )
    matches_with_avg = sum(1 for r in results if r["averagePositions"] > 0)

    report = {
        "source": "SofaScore public web endpoints",
        "league": "Uzbekistan Superliga",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "requestedMatches": args.matches,
        "matchesAnalyzed": analyzed,
        "errors": errors,
        "coverage": {
            "matchesWithBothLineups": {
                "count": lineup_matches,
                "total": analyzed,
                "percent": pct(lineup_matches, analyzed),
            },
            "matchesWithBothFormations": {
                "count": both_formations,
                "total": analyzed,
                "percent": pct(both_formations, analyzed),
            },
            "matchesWithAveragePositions": {
                "count": matches_with_avg,
                "total": analyzed,
                "percent": pct(matches_with_avg, analyzed),
            },
            "starterAveragePositionCoverage": {
                "count": total_avg_positions,
                "total": total_starters,
                "percent": pct(total_avg_positions, total_starters),
            },
            "sampledHeatmapCoverage": {
                "count": heatmap_success,
                "total": heatmap_requests,
                "percent": pct(heatmap_success, heatmap_requests),
                "totalPoints": heatmap_points,
            },
            "broadLineupPositions": broad_position_counts,
        },
        "interpretation": {
            "averagePositionsUsefulForDetailedPosition": (
                pct(total_avg_positions, total_starters) >= 80
                and pct(both_formations, analyzed) >= 80
            ),
            "heatmapsUsefulAsSupportingEvidence": pct(heatmap_success, heatmap_requests) >= 70,
            "note": (
                "Average positions + formation are preferred for LB/RB/DM/CM/AM/LW/RW/ST. "
                "Heatmaps should support the classification, not determine it alone."
            ),
        },
        "matches": results,
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== SOFASCORE POSITION COVERAGE ===")
    print(json.dumps(report["coverage"], ensure_ascii=False, indent=2))
    print("\nInterpretation:")
    print(json.dumps(report["interpretation"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
