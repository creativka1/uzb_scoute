#!/usr/bin/env python3
"""
Build conservative detailed football positions from SofaScore source data already
cached in this repository.

The model never invents a position from preferred foot or player statistics.
Each match position comes from a confirmed SofaScore starting XI + team
formation. The starting-XI order is interpreted with explicit templates for
formations observed in the dataset. If a cached SofaScore heatmap exists, it is
used only as a side-of-pitch consistency check.

Output:
  data/detailed_positions.json
"""

from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LINEUPS_DIR = ROOT / "data" / "cache" / "lineups"
HEATMAPS_DIR = ROOT / "data" / "cache" / "heatmaps"
OUTPUT = ROOT / "data" / "detailed_positions.json"

# Explicit templates only. We do not guess unsupported formations.
# SofaScore confirmed starting-XI order is right-to-left inside each line.
FORMATION_TEMPLATES: dict[str, list[list[str]]] = {
    "4-2-3-1": [
        ["RB", "CB", "CB", "LB"],
        ["DM", "DM"],
        ["RW", "AM", "LW"],
        ["ST"],
    ],
    "4-3-3": [
        ["RB", "CB", "CB", "LB"],
        ["CM", "CM", "CM"],
        ["RW", "ST", "LW"],
    ],
    "4-1-4-1": [
        ["RB", "CB", "CB", "LB"],
        ["DM"],
        ["RM", "CM", "CM", "LM"],
        ["ST"],
    ],
    "4-4-2": [
        ["RB", "CB", "CB", "LB"],
        ["RM", "CM", "CM", "LM"],
        ["ST", "ST"],
    ],
    "4-5-1": [
        ["RB", "CB", "CB", "LB"],
        ["RM", "CM", "CM", "CM", "LM"],
        ["ST"],
    ],
    "4-4-1-1": [
        ["RB", "CB", "CB", "LB"],
        ["RM", "CM", "CM", "LM"],
        ["AM"],
        ["ST"],
    ],
    "4-1-3-2": [
        ["RB", "CB", "CB", "LB"],
        ["DM"],
        ["RM", "CM", "LM"],
        ["ST", "ST"],
    ],
    "3-4-3": [
        ["CB", "CB", "CB"],
        ["RWB", "CM", "CM", "LWB"],
        ["RW", "ST", "LW"],
    ],
    "3-5-2": [
        ["CB", "CB", "CB"],
        ["RWB", "CM", "CM", "CM", "LWB"],
        ["ST", "ST"],
    ],
    "3-4-2-1": [
        ["CB", "CB", "CB"],
        ["RWB", "CM", "CM", "LWB"],
        ["AM", "AM"],
        ["ST"],
    ],
    "5-3-2": [
        ["RWB", "CB", "CB", "CB", "LWB"],
        ["CM", "CM", "CM"],
        ["ST", "ST"],
    ],
    "5-4-1": [
        ["RWB", "CB", "CB", "CB", "LWB"],
        ["RM", "CM", "CM", "LM"],
        ["ST"],
    ],
}

RIGHT_POSITIONS = {"RB", "RWB", "RM", "RW"}
LEFT_POSITIONS = {"LB", "LWB", "LM", "LW"}


def starters(side: dict[str, Any]) -> list[dict[str, Any]]:
    players = side.get("players")
    if not isinstance(players, list):
        return []
    return [
        item
        for item in players
        if isinstance(item, dict) and item.get("substitute") is not True
    ]


def flatten(lines: list[list[str]]) -> list[str]:
    return [slot for line in lines for slot in line]


def heatmap_path(event_id: int, player_id: int) -> Path:
    return HEATMAPS_DIR / f"{event_id}_{player_id}.json"


def heatmap_lateral_median(event_id: int, player_id: int) -> float | None:
    path = heatmap_path(event_id, player_id)
    if not path.exists():
        return None

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

    points = payload.get("heatmap")
    if not isinstance(points, list):
        return None

    ys: list[float] = []
    for point in points:
        if not isinstance(point, dict):
            continue
        y = point.get("y")
        if isinstance(y, (int, float)):
            ys.append(float(y))

    if not ys:
        return None
    return round(float(statistics.median(ys)), 2)


def heatmap_side_conflict(position: str, median_y: float | None) -> bool:
    """
    SofaScore heatmap uses y=0..100 laterally. We only reject a formation slot
    when the heatmap strongly contradicts its side.

    Conservative dead-zone:
      right-sided slot + median y >= 65 -> conflict
      left-sided slot  + median y <= 35 -> conflict
    Central values are not used to force a side.
    """
    if median_y is None:
        return False
    if position in RIGHT_POSITIONS and median_y >= 65:
        return True
    if position in LEFT_POSITIONS and median_y <= 35:
        return True
    return False


def confidence_label(starts: int, top_share: float) -> str | None:
    if starts >= 6 and top_share >= 0.70:
        return "high"
    if starts >= 3 and top_share >= 0.60:
        return "medium"
    if starts >= 2 and top_share >= 0.60:
        return "low"
    return None


def main() -> None:
    per_player: dict[int, list[dict[str, Any]]] = defaultdict(list)
    unsupported_formations: Counter[str] = Counter()
    files_checked = 0
    confirmed_matches = 0
    usable_team_sides = 0
    heatmap_validations = 0
    heatmap_conflicts = 0

    for file in sorted(LINEUPS_DIR.glob("*.json")):
        try:
            event_id = int(file.stem)
            lineup = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue

        files_checked += 1
        if lineup.get("confirmed") is not True:
            continue
        confirmed_matches += 1

        for side_name in ("home", "away"):
            side = lineup.get(side_name)
            if not isinstance(side, dict):
                continue

            formation = side.get("formation")
            if not isinstance(formation, str):
                continue

            template = FORMATION_TEMPLATES.get(formation)
            if template is None:
                unsupported_formations[formation] += 1
                continue

            xi = starters(side)
            slots = flatten(template)
            if len(xi) != 11 or len(slots) != 10:
                continue

            # Goalkeeper is the first starter in SofaScore confirmed lineups.
            goalkeeper = xi[0]
            gk_player = goalkeeper.get("player") or {}
            gk_id = gk_player.get("id")
            if isinstance(gk_id, int):
                per_player[gk_id].append(
                    {
                        "eventId": event_id,
                        "formation": formation,
                        "side": side_name,
                        "position": "GK",
                        "heatmapMedianY": None,
                        "heatmapValidated": False,
                        "heatmapConflict": False,
                    }
                )

            outfield = xi[1:]
            if len(outfield) != len(slots):
                continue

            usable_team_sides += 1

            for item, position in zip(outfield, slots):
                player = item.get("player") or {}
                player_id = player.get("id")
                if not isinstance(player_id, int):
                    continue

                median_y = heatmap_lateral_median(event_id, player_id)
                validated = median_y is not None and (
                    position in RIGHT_POSITIONS or position in LEFT_POSITIONS
                )
                conflict = heatmap_side_conflict(position, median_y)

                if validated:
                    heatmap_validations += 1
                if conflict:
                    heatmap_conflicts += 1

                per_player[player_id].append(
                    {
                        "eventId": event_id,
                        "formation": formation,
                        "side": side_name,
                        "position": position,
                        "heatmapMedianY": median_y,
                        "heatmapValidated": validated and not conflict,
                        "heatmapConflict": conflict,
                    }
                )

    output_players: dict[str, Any] = {}

    for player_id, appearances in per_player.items():
        # A strong heatmap contradiction removes only that one appearance from
        # the consensus; it does not rewrite it to another side.
        usable = [a for a in appearances if not a["heatmapConflict"]]
        counts = Counter(a["position"] for a in usable)
        total = sum(counts.values())

        if not total:
            continue

        primary, primary_count = counts.most_common(1)[0]
        share = primary_count / total
        confidence = confidence_label(total, share)
        detailed_position = primary if confidence is not None else None

        secondary = [
            {"position": pos, "starts": count, "share": round(count / total, 3)}
            for pos, count in counts.most_common()
            if pos != primary and count / total >= 0.20
        ]

        output_players[str(player_id)] = {
            "detailedPosition": detailed_position,
            "confidence": confidence,
            "startsUsed": total,
            "primaryStarts": primary_count,
            "primaryShare": round(share, 3),
            "positionDistribution": dict(counts.most_common()),
            "secondaryPositions": secondary,
            "heatmapMatchesAvailable": sum(
                1 for a in appearances if a["heatmapMedianY"] is not None
            ),
            "heatmapMatchesValidated": sum(
                1 for a in appearances if a["heatmapValidated"]
            ),
            "heatmapConflicts": sum(
                1 for a in appearances if a["heatmapConflict"]
            ),
            "method": "SofaScore confirmed lineup + formation; cached heatmap is used as a side consistency check when available",
        }

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": {
            "source": "SofaScore confirmed match lineups and formations",
            "heatmapRole": "validation only; never used alone to invent a position",
            "minimumEvidence": "at least 2 usable starts and >=60% consensus; stronger thresholds for medium/high confidence",
            "unsupportedFormationsAreIgnored": True,
        },
        "summary": {
            "lineupFilesChecked": files_checked,
            "confirmedMatches": confirmed_matches,
            "usableTeamSides": usable_team_sides,
            "playersWithAnyAppearance": len(per_player),
            "playersWithDetailedPosition": sum(
                1
                for item in output_players.values()
                if item["detailedPosition"] is not None
            ),
            "heatmapValidations": heatmap_validations,
            "heatmapConflicts": heatmap_conflicts,
            "unsupportedFormations": dict(unsupported_formations.most_common()),
        },
        "players": output_players,
    }

    OUTPUT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
