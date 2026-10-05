#!/usr/bin/env python3
"""Sync official 2026 Uzbekistan Super League player season statistics from PFL.

Official PFL club statistics expose games, minutes, starts, substitutions,
bench appearances, goals, own goals, assists, goal contributions and cards.
Advanced event metrics are intentionally left unavailable rather than invented.
"""
from __future__ import annotations

import argparse
import html as html_lib
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/pfl_player_stats_2026.json"
AUDIT = ROOT / "data/audits/pfl_player_stats_2026.json"
BASE = "https://pfl.uz"
EXPECTED_CLUBS = 16


def num(text: str):
    text = (text or "").strip()
    if not text:
        return 0
    match = re.match(r"^(\d+)", text)
    return int(match.group(1)) if match else None


def penalty_goals(text: str):
    text = (text or "").strip()
    match = re.match(r"^(\d+)(?:\((\d+)\))?$", text)
    if not match:
        return num(text), None
    return int(match.group(1)), int(match.group(2)) if match.group(2) is not None else 0


def normalize_team_name(value: str) -> str:
    value = html_lib.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip().casefold()
    return value


def fetch_match_club_ids(url: str, expected_names: set[str]) -> set[int]:
    req = Request(
        url,
        headers={
            "User-Agent": "UzStatPFLStats/1.0 (+https://github.com/creativka1/uzb_scoute)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(req, timeout=20) as response:
            if response.status != 200:
                return set()
            source = response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError):
        return set()

    result: set[int] = set()
    for club_id, body in re.findall(
        r"""<a\b[^>]*href=["']/en/club/(\d+)(?:["'/?#])[^>]*>(.*?)</a>""",
        source,
        flags=re.I | re.S,
    ):
        if normalize_team_name(body) in expected_names:
            result.add(int(club_id))
    return result


def discover_superleague_clubs() -> set[int]:
    core_path = ROOT / "data/official_match_core_2026.json"
    if not core_path.exists():
        raise RuntimeError("official_match_core_2026.json is required before PFL player sync")

    core = json.loads(core_path.read_text(encoding="utf-8"))
    teams = {
        team["id"]: team["name"]
        for team in core.get("teams", [])
        if isinstance(team.get("id"), int) and isinstance(team.get("name"), str)
    }
    matches = [
        match
        for match in core.get("matches", [])
        if match.get("league") == "UZB"
        and isinstance(match.get("sourcePath"), str)
        and match.get("sourcePath")
        and match.get("homeTeamId") in teams
        and match.get("awayTeamId") in teams
    ]
    if not matches:
        raise RuntimeError("No UZB 2026 official matches available for club discovery")

    club_ids: set[int] = set()
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {}
        for match in matches:
            expected = {
                normalize_team_name(teams[match["homeTeamId"]]),
                normalize_team_name(teams[match["awayTeamId"]]),
            }
            future = pool.submit(fetch_match_club_ids, match["sourcePath"], expected)
            futures[future] = match["sourcePath"]

        for future in as_completed(futures):
            club_ids.update(future.result())

    if len(club_ids) != EXPECTED_CLUBS:
        raise RuntimeError(
            f"Expected {EXPECTED_CLUBS} Superliga clubs matched to official teams, "
            f"found {len(club_ids)}: {sorted(club_ids)}"
        )
    return club_ids


def sync(delay_ms: int = 250):
    generated_at = datetime.now(timezone.utc).isoformat()
    club_ids = discover_superleague_clubs()
    players = []

    expected = [
        "#", "Player", "Games", "Minutes", "Starting lineup",
        "Substituted in", "Substituted out", "On the bench",
        "Goals (with penalties)", "Own goals", "Assists",
        "Goals + Assists", "Yellow card", "Second yellow card", "Red card",
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200}, locale="en-US")
        parsed_clubs = []

        for club_id in sorted(club_ids):
            url = f"{BASE}/en/club/{club_id}/statistics"
            response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            if response is None or response.status >= 400:
                raise RuntimeError(
                    f"PFL statistics page unavailable for club {club_id}: "
                    f"{None if response is None else response.status}"
                )
            page.wait_for_timeout(1800)

            tables = page.locator("table")
            if tables.count() == 0:
                raise RuntimeError(f"No rendered statistics table for club {club_id}")
            table = tables.first

            headers = table.locator("thead th")
            tips = []
            for i in range(headers.count()):
                th = headers.nth(i)
                tips.append((th.get_attribute("data-tip") or th.inner_text() or "").strip())
            if tips[:len(expected)] != expected:
                raise RuntimeError(f"Unexpected PFL columns for club {club_id}: {tips}")

            club_name = ""
            h1 = page.locator("h1")
            if h1.count():
                club_name = h1.first.inner_text().strip()
            if not club_name:
                club_name = f"club-{club_id}"

            rows = table.locator("tbody tr")
            club_players = 0
            for i in range(rows.count()):
                row = rows.nth(i)
                cells = row.locator("td")
                if cells.count() < len(expected):
                    continue

                vals = [cells.nth(j).inner_text().strip() for j in range(len(expected))]
                link = cells.nth(1).locator('a[href*="/player/"]')
                href = link.first.get_attribute("href") if link.count() else None
                player_match = re.search(r"/player/(\d+)", href or "")
                if not player_match:
                    continue

                goals, penalties = penalty_goals(vals[8])
                players.append({
                    "league": "UZB",
                    "seasonYear": 2026,
                    "source": "pfl-official",
                    "clubId": club_id,
                    "club": club_name,
                    "playerId": int(player_match.group(1)),
                    "shirtNumber": num(vals[0]),
                    "name": vals[1],
                    "games": num(vals[2]),
                    "minutes": num(vals[3]),
                    "starts": num(vals[4]),
                    "substitutedIn": num(vals[5]),
                    "substitutedOut": num(vals[6]),
                    "bench": num(vals[7]),
                    "goals": goals,
                    "penaltyGoals": penalties,
                    "ownGoals": num(vals[9]),
                    "assists": num(vals[10]),
                    "goalContributions": num(vals[11]),
                    "yellowCards": num(vals[12]),
                    "secondYellowCards": num(vals[13]),
                    "redCards": num(vals[14]),
                    "profileUrl": f"{BASE}/en/player/{int(player_match.group(1))}",
                })
                club_players += 1

            if club_players == 0:
                raise RuntimeError(f"No player rows found for club {club_id}")
            parsed_clubs.append({"id": club_id, "name": club_name, "players": club_players})
            page.wait_for_timeout(delay_ms)

        browser.close()

    if len(parsed_clubs) != EXPECTED_CLUBS:
        raise RuntimeError(
            f"Expected statistics for {EXPECTED_CLUBS} Superliga clubs, got {len(parsed_clubs)}"
        )
    if len(players) < 200:
        raise RuntimeError(f"Only {len(players)} player rows found; refusing incomplete sync")

    duplicate_ids = {}
    for player in players:
        duplicate_ids.setdefault(player["playerId"], []).append(player["clubId"])
    duplicate_ids = {
        str(player_id): club_ids
        for player_id, club_ids in duplicate_ids.items()
        if len(club_ids) > 1
    }

    payload = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "source": "pfl-official",
        "league": "UZB",
        "seasonYear": 2026,
        "clubs": parsed_clubs,
        "players": players,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps({
        "status": "success",
        "updatedAt": generated_at,
        "clubs": len(parsed_clubs),
        "players": len(players),
        "duplicatePlayerIdsAcrossClubs": duplicate_ids,
        "fields": [
            "games", "minutes", "starts", "substitutedIn", "substitutedOut",
            "bench", "goals", "penaltyGoals", "ownGoals", "assists",
            "goalContributions", "yellowCards", "secondYellowCards", "redCards",
        ],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "clubs": len(parsed_clubs),
        "players": len(players),
        "duplicatesAcrossClubs": len(duplicate_ids),
    }, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay-ms", type=int, default=250)
    args = parser.parse_args()
    sync(max(100, args.delay_ms))
