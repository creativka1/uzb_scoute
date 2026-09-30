#!/usr/bin/env python3
"""
Audit whether the SofaScore data already cached in this repository is sufficient
to support more detailed football positions for Uzbekistan Superliga.

Important:
- This script does NOT assign LB/RB/DM/CM/AM/LW/RW/ST to players.
- It checks only source-backed signals already present in the repo:
  * confirmed match lineups
  * team formation
  * complete starting XI
  * broad lineup positions (G/D/M/F)
  * SofaScore's hasEventPlayerHeatMap flag on the event

Why cache-only?
Direct SofaScore event endpoints may return HTTP 403 from GitHub-hosted runners.
The repository already contains the same match lineups collected by the existing
sync pipeline, so this audit avoids treating access blocking as "missing data".

Output:
  data/audits/sofascore_position_coverage.json
"""

from __future__ import annotations

import argparse
import glob
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def pct(num: int, den: int) -> float:
    return round(num / den * 100.0, 1) if den else 0.0


def cached_uzb_events() -> list[dict[str, Any]]:
    events: dict[int, dict[str, Any]] = {}
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
            if not isinstance(event_id, int):
                continue
            events[event_id] = event

    return sorted(
        events.values(),
        key=lambda e: int(e.get("startTimestamp") or 0),
        reverse=True,
    )


def starters(side: dict[str, Any]) -> list[dict[str, Any]]:
    rows = side.get("players") if isinstance(side, dict) else None
    if not isinstance(rows, list):
        return []
    return [
        p for p in rows
        if isinstance(p, dict) and p.get("substitute") is not True
    ]


def broad_position(item: dict[str, Any]) -> str:
    player = item.get("player") or {}
    return str(item.get("position") or player.get("position") or "?")


def formation_expected_counts(formation: str | None) -> tuple[int, ...] | None:
    if not formation:
        return None
    try:
        parts = tuple(int(x) for x in formation.split("-"))
    except ValueError:
        return None
    return parts if sum(parts) == 10 else None


def broad_counts_match_formation(
    formation: str | None,
    xi: list[dict[str, Any]],
) -> bool | None:
    expected = formation_expected_counts(formation)
    if expected is None or len(xi) != 11:
        return None

    counts = Counter(broad_position(p) for p in xi)
    # Formation lines after goalkeeper map to SofaScore's broad categories.
    # A 4-2-3-1, for example, can be represented as 4 D, 5 M, 1 F.
    # We therefore compare total D/M/F count against formation line totals,
    # not individual LB/RB/etc slots.
    defenders = expected[0]
    forwards = expected[-1]
    midfielders = 10 - defenders - forwards

    return (
        counts.get("G", 0) == 1
        and counts.get("D", 0) == defenders
        and counts.get("M", 0) == midfielders
        and counts.get("F", 0) == forwards
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matches", type=int, default=30)
    parser.add_argument(
        "--output",
        default="data/audits/sofascore_position_coverage.json",
    )
    args = parser.parse_args()

    events = cached_uzb_events()[: args.matches]
    if not events:
        raise RuntimeError("No cached finished UZB events found.")

    rows: list[dict[str, Any]] = []

    lineup_cached = 0
    confirmed = 0
    both_formations = 0
    complete_xi = 0
    heatmap_flag = 0
    formation_side_total = 0
    formation_side_consistent = 0
    formation_counter: Counter[str] = Counter()

    for event in events:
        event_id = event["id"]
        lineup_path = Path(f"data/cache/lineups/{event_id}.json")
        has_heatmap = event.get("hasEventPlayerHeatMap") is True
        if has_heatmap:
            heatmap_flag += 1

        row: dict[str, Any] = {
            "eventId": event_id,
            "match": (
                f"{(event.get('homeTeam') or {}).get('name', '?')} vs "
                f"{(event.get('awayTeam') or {}).get('name', '?')}"
            ),
            "hasEventPlayerHeatMap": has_heatmap,
            "lineupCached": lineup_path.exists(),
            "confirmed": False,
            "homeFormation": None,
            "awayFormation": None,
            "homeStarters": 0,
            "awayStarters": 0,
        }

        if not lineup_path.exists():
            rows.append(row)
            continue

        lineup_cached += 1
        lineup = json.loads(lineup_path.read_text(encoding="utf-8"))
        if lineup.get("confirmed") is True:
            confirmed += 1
            row["confirmed"] = True

        home = lineup.get("home") or {}
        away = lineup.get("away") or {}
        hf = home.get("formation")
        af = away.get("formation")
        row["homeFormation"] = hf
        row["awayFormation"] = af

        if hf:
            formation_counter[str(hf)] += 1
        if af:
            formation_counter[str(af)] += 1
        if hf and af:
            both_formations += 1

        hxi = starters(home)
        axi = starters(away)
        row["homeStarters"] = len(hxi)
        row["awayStarters"] = len(axi)
        if len(hxi) == 11 and len(axi) == 11:
            complete_xi += 1

        for formation, xi in ((hf, hxi), (af, axi)):
            consistency = broad_counts_match_formation(formation, xi)
            if consistency is not None:
                formation_side_total += 1
                if consistency:
                    formation_side_consistent += 1

        rows.append(row)

    n = len(events)

    report = {
        "source": "SofaScore data already cached by this repository",
        "league": "Uzbekistan Superliga",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "matchesChecked": n,
        "coverage": {
            "cachedLineups": {
                "count": lineup_cached,
                "total": n,
                "percent": pct(lineup_cached, n),
            },
            "confirmedLineups": {
                "count": confirmed,
                "total": n,
                "percent": pct(confirmed, n),
            },
            "bothTeamFormations": {
                "count": both_formations,
                "total": n,
                "percent": pct(both_formations, n),
            },
            "completeStartingXI": {
                "count": complete_xi,
                "total": n,
                "percent": pct(complete_xi, n),
            },
            "matchesFlaggedWithPlayerHeatmaps": {
                "count": heatmap_flag,
                "total": n,
                "percent": pct(heatmap_flag, n),
            },
            "formationVsBroadPositionConsistency": {
                "count": formation_side_consistent,
                "total": formation_side_total,
                "percent": pct(formation_side_consistent, formation_side_total),
            },
            "formations": dict(formation_counter.most_common()),
        },
        "conclusion": {
            "detailedPositionsPotentiallyFeasible": (
                pct(both_formations, n) >= 80
                and pct(heatmap_flag, n) >= 80
                and pct(complete_xi, n) >= 80
            ),
            "recommendedMethod": (
                "Use confirmed formation + repeated match lineups as the base. "
                "Use average-position/heatmap coordinates only to resolve left/right "
                "and role depth. Never infer LB/RB/LW/RW from preferred foot alone."
            ),
            "heatmapCaveat": (
                "A heatmap alone is not an official position: players roam, press, "
                "take set pieces and switch sides. Aggregate several matches."
            ),
        },
        "matches": rows,
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== SOFASCORE CACHED POSITION COVERAGE ===")
    print(json.dumps(report["coverage"], ensure_ascii=False, indent=2))
    print("\nConclusion:")
    print(json.dumps(report["conclusion"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
