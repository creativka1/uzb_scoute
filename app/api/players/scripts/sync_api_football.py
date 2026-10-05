#!/usr/bin/env python3
"""Sync Uzbekistan Super League through the API-Football free plan.

The rest of Scoute expects cached payloads shaped like the historical SofaScore
cache. This adapter keeps that contract so the API route, percentiles, radar
charts and recruitment logic do not need provider-specific branches.

Free-plan friendly behaviour:
- one league discovery request;
- one fixtures request per selected season;
- fixture/player statistics are downloaded only when not cached;
- the script stops cleanly at --max-requests and keeps a resumable partial cache.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
from data_integrity import TOURNAMENTS, atomic_json, load, rebuild  # noqa: E402

BASE_URL = "https://v3.football.api-sports.io"
COUNTRIES = {"UZB": "Uzbekistan", "KAZ": "Kazakhstan"}
LEAGUE_NAMES = {
    "UZB": ("super league", "superliga"),
    "KAZ": ("premier league",),
}
FINISHED = {"FT", "AET", "PEN"}
EVENT_OFFSET = 600_000_000
PLAYER_OFFSET = 700_000_000
TEAM_OFFSET = 800_000_000


def safe_number(value):
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value if value >= 0 else None
    if isinstance(value, str):
        raw = value.strip().rstrip("%")
        try:
            parsed = float(raw)
        except ValueError:
            return None
        return parsed if parsed >= 0 else None
    return None


def position_code(value):
    value = (value or "").strip().upper()
    if value in {"G", "GK", "GOALKEEPER"}:
        return "G"
    if value in {"D", "DF", "DEFENDER"}:
        return "D"
    if value in {"M", "MF", "MIDFIELDER"}:
        return "M"
    if value in {"F", "FW", "A", "ATTACKER"}:
        return "F"
    return None


def season_id_for(league, year):
    tid = TOURNAMENTS[league]
    payload = load(ROOT / f"data/cache/seasons/{league}_{tid}_seasons.json", {}) or {}
    for season in payload.get("seasons", []):
        if str(season.get("year")) == str(year) and isinstance(season.get("id"), int):
            return season["id"]
    official = load(ROOT / "data/official_match_core_2026.json", {}) or {}
    for season in (official.get("seasons", {}) or {}).get(league, []):
        if str(season.get("year")) == str(year) and isinstance(season.get("id"), int):
            return season["id"]
    return 950_000_000 + int(year)


def normalize_fixture(raw, league, season_id):
    fixture = raw.get("fixture") or {}
    competition = raw.get("league") or {}
    teams = raw.get("teams") or {}
    goals = raw.get("goals") or {}
    status = (fixture.get("status") or {}).get("short")
    home = teams.get("home") or {}
    away = teams.get("away") or {}
    fixture_id = fixture.get("id")
    timestamp = fixture.get("timestamp")
    if not isinstance(fixture_id, int) or not isinstance(timestamp, (int, float)):
        raise RuntimeError("API-Football fixture is missing id/timestamp")
    if not isinstance(home.get("id"), int) or not isinstance(away.get("id"), int):
        raise RuntimeError(f"API-Football fixture {fixture_id} is missing team ids")
    return {
        "id": EVENT_OFFSET + fixture_id,
        "sourceFixtureId": fixture_id,
        "season": {"id": season_id, "name": str(competition.get("season") or "")},
        "tournament": {"uniqueTournament": {"id": TOURNAMENTS[league]}},
        "status": {"type": "finished" if status in FINISHED else "notstarted"},
        "startTimestamp": int(timestamp),
        "homeTeam": {"id": TEAM_OFFSET + home["id"], "name": home.get("name")},
        "awayTeam": {"id": TEAM_OFFSET + away["id"], "name": away.get("name")},
        "homeScore": {"current": safe_number(goals.get("home"))},
        "awayScore": {"current": safe_number(goals.get("away"))},
        "_provider": "api-football",
        "_providerLeagueId": competition.get("id"),
    }


def normalize_player(item, team_id):
    player = item.get("player") or {}
    blocks = item.get("statistics") or []
    stats = blocks[0] if blocks and isinstance(blocks[0], dict) else {}
    games = stats.get("games") or {}
    shots = stats.get("shots") or {}
    goals = stats.get("goals") or {}
    passes = stats.get("passes") or {}
    tackles = stats.get("tackles") or {}
    duels = stats.get("duels") or {}
    dribbles = stats.get("dribbles") or {}

    provider_player_id = player.get("id")
    if not isinstance(provider_player_id, int):
        return None

    minutes = safe_number(games.get("minutes"))
    total_duels = safe_number(duels.get("total"))
    won_duels = safe_number(duels.get("won"))
    duel_lost = None
    if total_duels is not None and won_duels is not None and total_duels >= won_duels:
        duel_lost = total_duels - won_duels

    pos = position_code(games.get("position"))
    normalized_player = {
        "id": PLAYER_OFFSET + provider_player_id,
        "name": player.get("name"),
        "shortName": player.get("name"),
        "position": pos,
    }
    return {
        "player": normalized_player,
        "teamId": team_id,
        "position": pos,
        "substitute": games.get("substitute") if isinstance(games.get("substitute"), bool) else None,
        "statistics": {
            "minutesPlayed": minutes,
            "goals": safe_number(goals.get("total")),
            "goalAssist": safe_number(goals.get("assists")),
            "totalShots": safe_number(shots.get("total")),
            "keyPass": safe_number(passes.get("key")),
            "totalTackle": safe_number(tackles.get("total")),
            "interceptionWon": safe_number(tackles.get("interceptions")),
            "saves": safe_number(goals.get("saves")),
            "wonContest": safe_number(dribbles.get("success")),
            "totalContest": safe_number(dribbles.get("attempts")),
            "totalPass": safe_number(passes.get("total")),
            "accuratePass": safe_number(passes.get("accuracy")),
            "duelWon": won_duels,
            "duelLost": duel_lost,
            "aerialWon": None,
            "aerialLost": None,
            "expectedGoals": safe_number(stats.get("expected_goals")),
            "expectedAssists": safe_number(stats.get("expected_assists")),
        },
    }


def normalize_fixture_players(payload, event):
    response = payload.get("response")
    if not isinstance(response, list):
        raise RuntimeError("Invalid /fixtures/players response")

    by_provider_team = {}
    for side in response:
        team = side.get("team") or {}
        if isinstance(team.get("id"), int):
            by_provider_team[team["id"]] = side.get("players") or []

    home_provider = event["homeTeam"]["id"] - TEAM_OFFSET
    away_provider = event["awayTeam"]["id"] - TEAM_OFFSET

    def convert(provider_team_id, normalized_team_id):
        rows = by_provider_team.get(provider_team_id, [])
        result = []
        for row in rows:
            item = normalize_player(row, normalized_team_id)
            if item is not None:
                result.append(item)
        return result

    home_players = convert(home_provider, event["homeTeam"]["id"])
    away_players = convert(away_provider, event["awayTeam"]["id"])
    return {
        "confirmed": bool(home_players and away_players),
        "home": {"players": home_players},
        "away": {"players": away_players},
        "_provider": "api-football",
        "_sourceFixtureId": event["sourceFixtureId"],
    }


def pick_league(payload, league):
    candidates = payload.get("response")
    if not isinstance(candidates, list):
        raise RuntimeError("Invalid /leagues response")
    names = LEAGUE_NAMES[league]
    ranked = []
    for row in candidates:
        info = row.get("league") or {}
        name = str(info.get("name") or "").casefold()
        if any(token in name for token in names) and isinstance(info.get("id"), int):
            ranked.append(row)
    if not ranked:
        raise RuntimeError(f"API-Football did not return a supported league for {COUNTRIES[league]}")
    ranked.sort(key=lambda row: 0 if str((row.get("league") or {}).get("type")).casefold() == "league" else 1)
    return ranked[0]


def sync(max_requests=95, delay=0.25, league_filter="UZB", season_year=2026):
    key = os.environ.get("API_FOOTBALL_KEY", "").strip()
    if not key:
        raise RuntimeError("API_FOOTBALL_KEY is not configured")

    session = requests.Session(impersonate="chrome120")
    headers = {"x-apisports-key": key}
    calls = 0
    exhausted = False

    def fetch(path, params):
        nonlocal calls
        if calls >= max_requests:
            raise StopIteration
        response = session.get(f"{BASE_URL}/{path}", headers=headers, params=params, timeout=30)
        calls += 1
        if response.status_code in (401, 403):
            raise RuntimeError(f"API-Football access failed: HTTP {response.status_code}")
        if response.status_code == 429:
            raise StopIteration
        if response.status_code != 200:
            raise RuntimeError(f"API-Football request failed: HTTP {response.status_code}")
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Invalid API-Football payload")
        errors = payload.get("errors")
        if errors:
            raise RuntimeError(f"API-Football error: {errors}")
        if delay:
            time.sleep(delay)
        return payload

    league = league_filter or "UZB"
    if league not in COUNTRIES:
        raise RuntimeError(f"Unsupported league code: {league}")

    now = datetime.now(timezone.utc).isoformat()
    base = ROOT / "data/cache/seasons"
    season_id = season_id_for(league, season_year)

    discovery = fetch("leagues", {"country": COUNTRIES[league], "season": season_year})
    selected = pick_league(discovery, league)
    provider_league_id = selected["league"]["id"]

    # Keep the existing Scoute/Sofa logical season ids so the UI contract and
    # historical cache remain compatible. Only append missing metadata.
    season_path = base / f"{league}_{TOURNAMENTS[league]}_seasons.json"
    existing_seasons = load(season_path, {}) or {}
    seasons = list(existing_seasons.get("seasons") or [])
    if not any(str(s.get("year")) == str(season_year) for s in seasons):
        seasons.insert(0, {"id": season_id, "name": f"{selected['league'].get('name')} {season_year}", "year": season_year})
    if len(seasons) < 2:
        seasons.append({"id": season_id_for(league, season_year - 1), "name": str(season_year - 1), "year": season_year - 1})
    atomic_json(season_path, {"seasons": seasons})

    fixtures_payload = fetch("fixtures", {"league": provider_league_id, "season": season_year})
    raw_fixtures = fixtures_payload.get("response")
    if not isinstance(raw_fixtures, list):
        raise RuntimeError("Invalid /fixtures response")
    events = [normalize_fixture(raw, league, season_id) for raw in raw_fixtures]
    atomic_json(base / f"matches_{league}_{season_id}_p0.json", {"events": events, "hasNextPage": False})

    finished = [event for event in events if event["status"]["type"] == "finished"]
    completed = 0
    skipped = 0

    for event in finished:
        target = ROOT / f"data/cache/lineups/{event['id']}.json"
        cached = load(target, {}) or {}
        if cached.get("_provider") == "api-football" and cached.get("confirmed") is True:
            skipped += 1
            continue
        try:
            player_payload = fetch("fixtures/players", {"fixture": event["sourceFixtureId"]})
        except StopIteration:
            exhausted = True
            break
        lineup = normalize_fixture_players(player_payload, event)
        if lineup["confirmed"]:
            atomic_json(target, lineup)
            completed += 1

    linked_now = sum(
        1
        for event in finished
        if (load(ROOT / f"data/cache/lineups/{event['id']}.json", {}) or {}).get("confirmed") is True
    )
    complete = linked_now == len(finished) and not exhausted
    atomic_json(base / f"sync_{league}_{season_id}.json", {
        "complete": complete,
        "lastSyncedAt": now,
        "pages": 1,
        "provider": "api-football",
        "providerLeagueId": provider_league_id,
        "finishedFixtures": len(finished),
        "lineupsCached": linked_now,
        "requestBudgetExhausted": exhausted,
    })

    report = rebuild(ROOT)
    audit = {
        "status": "success" if complete else "partial",
        "updatedAt": now,
        "provider": "api-football",
        "league": league,
        "seasonYear": season_year,
        "providerLeagueId": provider_league_id,
        "requestsMade": calls,
        "maxRequests": max_requests,
        "finishedFixtures": len(finished),
        "downloadedThisRun": completed,
        "alreadyCached": skipped,
        "lineupsCached": linked_now,
        "complete": complete,
        "linkedLineups": report.get("linkedLineups"),
    }
    atomic_json(ROOT / "data/audits/statistics_sync_status.json", audit)
    print(audit)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-requests", type=int, default=95)
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--league", choices=sorted(COUNTRIES), default="UZB")
    parser.add_argument("--season-year", type=int, default=2026)
    args = parser.parse_args()
    try:
        sync(max(3, args.max_requests), max(0.0, args.delay), args.league, args.season_year)
    except Exception as error:
        atomic_json(ROOT / "data/audits/statistics_sync_status.json", {
            "status": "failed",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "provider": "api-football",
            "error": str(error),
        })
        raise
