#!/usr/bin/env python3
"""Sync official 2026 Uzbekistan Super League player season statistics from PFL.

The official PFL club statistics pages expose:
games, minutes, starts, substitutions, bench appearances, goals, own goals,
assists, goal contributions and cards. Advanced event metrics are intentionally
not invented here.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/pfl_player_stats_2026.json"
AUDIT = ROOT / "data/audits/pfl_player_stats_2026.json"
BASE = "https://pfl.uz"


def num(text: str):
    text = (text or "").strip()
    if not text:
        return 0
    m = re.match(r"^(\d+)", text)
    return int(m.group(1)) if m else None


def penalty_goals(text: str):
    text = (text or "").strip()
    m = re.match(r"^(\d+)(?:\((\d+)\))?$", text)
    if not m:
        return num(text), None
    return int(m.group(1)), int(m.group(2)) if m.group(2) is not None else 0


def sync(delay_ms: int = 250):
    generated_at = datetime.now(timezone.utc).isoformat()
    clubs = {}
    players = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200}, locale="en-US")
        response = page.goto(f"{BASE}/en", wait_until="domcontentloaded", timeout=60000)
        if response is None or response.status >= 400:
            raise RuntimeError(f"PFL home unavailable: {None if response is None else response.status}")
        page.wait_for_timeout(2500)

        hrefs = page.locator('a[href^="/en/club/"]').evaluate_all(
            """els => els.map(a => ({href:a.getAttribute('href'), text:(a.textContent||'').trim()}))"""
        )
        for item in hrefs:
            m = re.fullmatch(r"/en/club/(\d+)", item.get("href") or "")
            if m:
                clubs[int(m.group(1))] = item.get("text") or None

        if len(clubs) < 10:
            raise RuntimeError(f"Only {len(clubs)} club links found on PFL home; refusing incomplete league")

        parsed_clubs = []
        for club_id in sorted(clubs):
            url = f"{BASE}/en/club/{club_id}/statistics"
            response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            if response is None or response.status >= 400:
                continue
            page.wait_for_timeout(1800)

            tables = page.locator("table")
            if tables.count() == 0:
                continue
            table = tables.first
            headers = table.locator("thead th")
            tips = []
            for i in range(headers.count()):
                th = headers.nth(i)
                tips.append((th.get_attribute("data-tip") or th.inner_text() or "").strip())

            expected = [
                "#", "Player", "Games", "Minutes", "Starting lineup",
                "Substituted in", "Substituted out", "On the bench",
                "Goals (with penalties)", "Own goals", "Assists",
                "Goals + Assists", "Yellow card", "Second yellow card", "Red card",
            ]
            if tips[:len(expected)] != expected:
                raise RuntimeError(f"Unexpected PFL columns for club {club_id}: {tips}")

            club_name = ""
            h1 = page.locator("h1")
            if h1.count():
                club_name = h1.first.inner_text().strip()
            if not club_name:
                club_name = clubs.get(club_id) or f"club-{club_id}"

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
                pm = re.search(r"/player/(\d+)", href or "")
                if not pm:
                    continue
                goals, penalties = penalty_goals(vals[8])
                player = {
                    "league": "UZB",
                    "seasonYear": 2026,
                    "source": "pfl-official",
                    "clubId": club_id,
                    "club": club_name,
                    "playerId": int(pm.group(1)),
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
                    "profileUrl": f"{BASE}/en/player/{int(pm.group(1))}",
                }
                players.append(player)
                club_players += 1

            if club_players:
                parsed_clubs.append({"id": club_id, "name": club_name, "players": club_players})
            page.wait_for_timeout(delay_ms)

        browser.close()

    # Home can contain links to clubs outside the active Superliga. Keep only
    # clubs whose rendered statistics table has current-season player rows.
    if len(parsed_clubs) < 12:
        raise RuntimeError(f"Only {len(parsed_clubs)} clubs yielded PFL statistics; refusing incomplete sync")
    if len(players) < 200:
        raise RuntimeError(f"Only {len(players)} player rows found; refusing incomplete sync")

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
        "fields": [
            "games", "minutes", "starts", "substitutedIn", "substitutedOut",
            "bench", "goals", "penaltyGoals", "ownGoals", "assists",
            "goalContributions", "yellowCards", "secondYellowCards", "redCards",
        ],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"clubs": len(parsed_clubs), "players": len(players)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay-ms", type=int, default=250)
    args = parser.parse_args()
    sync(max(100, args.delay_ms))
