#!/usr/bin/env python3
"""
Audit FotMob lineup coverage for Uzbekistan Superliga (league id 540).

This script does NOT write positions into the scouting dataset. It only measures
whether FotMob match data is complete enough to support detailed positions such
as LB/RB/DM/AM/LW/RW from actual match lineups.

Output:
  data/audits/fotmob_position_coverage.json
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://www.fotmob.com/api"
LEAGUE_ID = 540
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
)


def fetch_json(path: str, params: dict[str, Any], retries: int = 3) -> Any:
    url = f"{BASE}/{path}?{urlencode(params)}"
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json,text/plain,*/*",
                    "Referer": "https://www.fotmob.com/",
                },
            )
            with urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed GET {url}: {last_error}")


def fixture_candidates(payload: Any) -> list[dict[str, Any]]:
    """Find fixture-looking objects without depending on one exact schema."""
    found: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            match_id = node.get("id")
            home = node.get("home")
            away = node.get("away")
            if match_id is not None and isinstance(home, dict) and isinstance(away, dict):
                found.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)

    dedup: dict[str, dict[str, Any]] = {}
    for item in found:
        dedup[str(item.get("id"))] = item
    return list(dedup.values())


def fixture_finished(match: dict[str, Any]) -> bool:
    status = match.get("status")
    if isinstance(status, dict) and status.get("finished") is True:
        return True
    if match.get("notStarted") is False:
        return True
    return False


def fixture_sort_key(match: dict[str, Any]) -> str:
    status = match.get("status") or {}
    return str(
        status.get("utcTime")
        or match.get("utcTime")
        or match.get("matchDate")
        or match.get("time")
        or ""
    )


def normalize_lineup_teams(lineup: Any) -> list[dict[str, Any]]:
    if not isinstance(lineup, dict):
        return []

    teams: list[dict[str, Any]] = []
    if isinstance(lineup.get("homeTeam"), dict):
        teams.append(lineup["homeTeam"])
    if isinstance(lineup.get("awayTeam"), dict):
        teams.append(lineup["awayTeam"])

    raw = lineup.get("lineups")
    if isinstance(raw, list):
        teams.extend(x for x in raw if isinstance(x, dict))

    # Deduplicate if both schemas are present.
    dedup: dict[str, dict[str, Any]] = {}
    for idx, team in enumerate(teams):
        key = str(team.get("id") or team.get("teamId") or team.get("name") or idx)
        dedup[key] = team
    return list(dedup.values())


def team_starters(team: dict[str, Any]) -> list[dict[str, Any]]:
    starters = team.get("starters")
    if isinstance(starters, list):
        return [p for p in starters if isinstance(p, dict)]

    players = team.get("players")
    if isinstance(players, list):
        result = []
        for p in players:
            if not isinstance(p, dict):
                continue
            # Older lineup shapes may mark starters explicitly.
            if p.get("isStarter") is False:
                continue
            result.append(p)
        return result
    return []


def analyze_match(match: dict[str, Any]) -> dict[str, Any]:
    match_id = str(match.get("id"))
    detail = fetch_json("matchDetails", {"matchId": match_id})
    content = detail.get("content") if isinstance(detail, dict) else None
    lineup = content.get("lineup") if isinstance(content, dict) else None
    teams = normalize_lineup_teams(lineup)

    starters: list[dict[str, Any]] = []
    formations = 0
    for team in teams:
        if team.get("formation"):
            formations += 1
        starters.extend(team_starters(team))

    with_position_id = 0
    with_layout = 0
    with_both = 0

    for player in starters:
        has_position = player.get("positionId") is not None
        layout = player.get("horizontalLayout")
        has_layout = (
            isinstance(layout, dict)
            and isinstance(layout.get("x"), (int, float))
            and isinstance(layout.get("y"), (int, float))
        )
        with_position_id += int(has_position)
        with_layout += int(has_layout)
        with_both += int(has_position and has_layout)

    home = match.get("home") or {}
    away = match.get("away") or {}

    return {
        "matchId": match_id,
        "match": f"{home.get('name', '?')} vs {away.get('name', '?')}",
        "lineupPresent": bool(teams),
        "teamLineups": len(teams),
        "formations": formations,
        "starters": len(starters),
        "playersWithPositionId": with_position_id,
        "playersWithHorizontalLayout": with_layout,
        "playersWithBoth": with_both,
    }


def pct(num: int, den: int) -> float:
    return round((num / den * 100.0), 1) if den else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matches", type=int, default=30)
    parser.add_argument(
        "--output",
        default="data/audits/fotmob_position_coverage.json",
    )
    args = parser.parse_args()

    fixtures_payload = fetch_json("fixtures", {"id": LEAGUE_ID})
    fixtures = [m for m in fixture_candidates(fixtures_payload) if fixture_finished(m)]
    fixtures.sort(key=fixture_sort_key, reverse=True)
    fixtures = fixtures[: args.matches]

    if not fixtures:
        raise RuntimeError("No finished Superliga fixtures found from FotMob.")

    results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for index, match in enumerate(fixtures, start=1):
        try:
            row = analyze_match(match)
            results.append(row)
            print(
                f"[{index:02d}/{len(fixtures)}] {row['match']}: "
                f"teams={row['teamLineups']} formations={row['formations']} "
                f"starters={row['starters']} layout={row['playersWithHorizontalLayout']}"
            )
        except Exception as exc:
            errors.append({"matchId": str(match.get("id")), "error": str(exc)})
            print(f"[{index:02d}/{len(fixtures)}] ERROR {match.get('id')}: {exc}")
        time.sleep(0.15)

    matches_ok = len(results)
    lineup_matches = sum(r["teamLineups"] >= 2 for r in results)
    formation_matches = sum(r["formations"] >= 2 for r in results)
    total_starters = sum(r["starters"] for r in results)
    total_position = sum(r["playersWithPositionId"] for r in results)
    total_layout = sum(r["playersWithHorizontalLayout"] for r in results)
    total_both = sum(r["playersWithBoth"] for r in results)

    report = {
        "source": "FotMob (unofficial web endpoints)",
        "league": {"id": LEAGUE_ID, "name": "Uzbekistan Superliga"},
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "requestedMatches": args.matches,
        "finishedFixturesFound": len(fixtures),
        "matchesAnalyzed": matches_ok,
        "errors": errors,
        "coverage": {
            "matchesWithBothTeamLineups": {
                "count": lineup_matches,
                "total": matches_ok,
                "percent": pct(lineup_matches, matches_ok),
            },
            "matchesWithBothFormations": {
                "count": formation_matches,
                "total": matches_ok,
                "percent": pct(formation_matches, matches_ok),
            },
            "starterPlayersWithPositionId": {
                "count": total_position,
                "total": total_starters,
                "percent": pct(total_position, total_starters),
            },
            "starterPlayersWithHorizontalLayout": {
                "count": total_layout,
                "total": total_starters,
                "percent": pct(total_layout, total_starters),
            },
            "starterPlayersWithPositionAndLayout": {
                "count": total_both,
                "total": total_starters,
                "percent": pct(total_both, total_starters),
            },
        },
        "matches": results,
    }

    # Conservative gate: detailed left/right positions should not be enabled
    # unless match and player-coordinate coverage is genuinely high.
    lineup_pct = report["coverage"]["matchesWithBothTeamLineups"]["percent"]
    layout_pct = report["coverage"]["starterPlayersWithHorizontalLayout"]["percent"]
    report["recommendation"] = {
        "safeForDetailedPositions": lineup_pct >= 80 and layout_pct >= 80,
        "rule": "Enable detailed LB/RB/DM/AM/LW/RW only if both-team lineup coverage and starter coordinate coverage are each at least 80%.",
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== COVERAGE SUMMARY ===")
    print(json.dumps(report["coverage"], ensure_ascii=False, indent=2))
    print("\nRecommendation:", json.dumps(report["recommendation"], ensure_ascii=False))


if __name__ == "__main__":
    main()
