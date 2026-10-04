#!/usr/bin/env python3
"""Rebuild the serving dataset from source payloads, without invented defaults.

Only lineups joined to an explicit event/season contribute statistics. Unlinked
lineups stay untouched in the raw cache and are listed in the audit report.
Sparse missing fields are unknown, not zero. Totals describe cached matches,
never a claim of complete season coverage.
"""
from __future__ import annotations

import json
import hashlib
import gzip
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOURNAMENTS = {"UZB": 772, "KAZ": 682}
COUNTRIES = {"UZB": "UZ", "KAZ": "KZ"}
POSITION = {"G": "GK", "D": "DF", "M": "MF", "F": "FW"}
METRICS = {
    "goals": "goals", "assists": "goalAssist", "shots": "totalShots",
    "keyPasses": "keyPass", "tackles": "totalTackle",
    "interceptions": "interceptionWon", "saves": "saves",
    "dribbleWon": "wonContest", "dribbleTotal": "totalContest",
    "totalPass": "totalPass", "accuratePass": "accuratePass",
    "duelWon": "duelWon", "duelLost": "duelLost",
    "aerialWon": "aerialWon", "aerialLost": "aerialLost",
    "xG": "expectedGoals", "xA": "expectedAssists",
}


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None


def load(path, default=None):
    if not path.exists():
        return default
    # A corrupt cache must fail the build instead of silently losing records.
    return json.loads(path.read_text(encoding="utf-8-sig"))


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(content, encoding="utf-8")
    temp.replace(path)


def atomic_gzip(path, payload):
    content = gzip.compress(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode(), mtime=0)
    if path.exists() and path.read_bytes() == content:
        return
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_bytes(content)
    temp.replace(path)


def ratio(won, total):
    if won is None or total is None or total <= 0 or won > total:
        return None
    return round(100 * won / total, 1)


def aggregate(appearances):
    if not appearances:
        return None
    count = len(appearances)
    dates = [a.get("date") for a in appearances if isinstance(a.get("date"), (int, float))]
    result = {
        "matchesPlayed": count,
        "minutesPlayed": sum(a["statistics"]["minutesPlayed"] for a in appearances),
        "eventIds": sorted(a["eventId"] for a in appearances),
        "dateFrom": min(dates) if len(dates) == count else None,
        "dateTo": max(dates) if len(dates) == count else None,
        "metricCoverage": {}, "observedTotals": {}, "metricDetails": {},
    }
    for target, source in METRICS.items():
        values = [number(a["statistics"].get(source)) for a in appearances]
        known = [v for v in values if v is not None]
        result["metricCoverage"][target] = len(known)
        observed = round(sum(known), 4) if known else None
        result["observedTotals"][target] = observed
        result[target] = observed if len(known) == count else None
        covered = [a for a, v in zip(appearances, values) if v is not None]
        minutes = sum(a["statistics"]["minutesPlayed"] for a in covered)
        result["metricDetails"][target] = {
            "value": observed, "per90": round(observed / minutes * 90, 6) if observed is not None and minutes > 0 else None,
            "matches": len(covered), "totalMatches": count, "minutes": minutes,
            "totalMinutes": result["minutesPlayed"], "eventIds": sorted(a["eventId"] for a in covered),
            "status": "missing" if not covered else "complete" if len(covered) == count else "partial",
        }
    result["passAccPct"] = ratio(result["accuratePass"], result["totalPass"])
    result["dribbleSuccessRate"] = ratio(result["dribbleWon"], result["dribbleTotal"])
    for prefix in ("duel", "aerial"):
        won, lost = result[prefix + "Won"], result[prefix + "Lost"]
        result[prefix + "WinPct"] = ratio(won, won + lost if won is not None and lost is not None else None)
    # Ratios use paired observations, never independent sums from different matches.
    for key, numerator, denominator, add in [
        ("passAccPct", "accuratePass", "totalPass", False),
        ("dribbleSuccessRate", "wonContest", "totalContest", False),
        ("duelWinPct", "duelWon", "duelLost", True),
        ("aerialWinPct", "aerialWon", "aerialLost", True),
    ]:
        pairs = [(a, number(a["statistics"].get(numerator)), number(a["statistics"].get(denominator))) for a in appearances]
        pairs = [(a, n, d) for a, n, d in pairs if n is not None and d is not None and (add or n <= d)]
        top = sum(n for _, n, _ in pairs) if pairs else None
        bottom = sum(n + d if add else d for _, n, d in pairs) if pairs else None
        value = ratio(top, bottom)
        result["metricDetails"][key] = {
            "value": value, "per90": None, "matches": len(pairs), "totalMatches": count,
            "minutes": sum(a["statistics"]["minutesPlayed"] for a, _, _ in pairs),
            "totalMinutes": result["minutesPlayed"], "eventIds": sorted(a["eventId"] for a, _, _ in pairs),
            "numerator": top, "denominator": bottom,
            "status": "missing" if not pairs else "complete" if len(pairs) == count else "partial",
            "reason": "no_attempts" if bottom == 0 else "not_provided" if not pairs else None,
        }
    return result


def profile_fields(profile):
    """Authoritative snapshot replacement: absent fields clear stale values."""
    raw_value = profile.get("proposedMarketValueRaw") or {}
    country = (profile.get("country") or {}).get("alpha2")
    timestamp = number(profile.get("contractUntilTimestamp"))
    birth = profile.get("dateOfBirthTimestamp")
    birth = birth if isinstance(birth, (int, float)) and not isinstance(birth, bool) and math.isfinite(birth) else None
    jersey = profile.get("jerseyNumber")
    jersey = int(jersey) if str(jersey).isdigit() else None
    foot = profile.get("preferredFoot")
    return {
        "name": profile.get("name"), "shortName": profile.get("shortName"),
        "position": POSITION.get(profile.get("position")),
        "dateOfBirthTimestamp": birth,
        "jerseyNumber": jersey, "height": number(profile.get("height")),
        "preferredFoot": foot if foot in ("Right", "Left", "Both") else None,
        "countryCode": country.upper() if isinstance(country, str) and country else None,
        "marketValueCurrency": number(raw_value.get("value")) if raw_value.get("currency") == "EUR" else None,
        "contractUntil": datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat() if timestamp else None,
        "sourceDetailedPositions": profile.get("positionsDetailed") if isinstance(profile.get("positionsDetailed"), list) else [],
    }


def cached_events(root=ROOT):
    events = {}
    for league, tournament_id in TOURNAMENTS.items():
        for path in sorted((root / "data/cache/seasons").glob(f"matches_{league}_*.json")):
            sid = path.stem.split('_')[2]
            manifest = load(root / f"data/cache/seasons/sync_{league}_{sid}.json", {})
            page_index = int(path.stem.rsplit('_p', 1)[1])
            if manifest.get("complete") and page_index >= manifest.get("pages", 0):
                continue
            payload = load(path, {})
            for event in payload.get("events", payload.get("matches", [])):
                season = event.get("season") or {}
                tournament = (event.get("tournament") or {}).get("uniqueTournament") or {}
                if tournament.get("id") != tournament_id or not isinstance(season.get("id"), int):
                    raise ValueError(f"Unverifiable competition/season in {path}: {event.get('id')}")
                if event.get("status", {}).get("type") != "finished":
                    continue
                if not isinstance(event.get("startTimestamp"), (int, float)):
                    raise ValueError(f"Missing match date: {event.get('id')}")
                record = {**event, "league": league}
                if event["id"] in events and events[event["id"]]["season"]["id"] != season["id"]:
                    raise ValueError(f"Conflicting season for event {event['id']}")
                events[event["id"]] = record
    return events


def infer_unlinked_lineup_league(lineup, known_team_leagues, legacy_player_leagues):
    """Infer league only when cached evidence is unambiguous.

    Team IDs from previously verified matches are strongest. If neither team is
    known, require a strong majority of previously classified players. This is
    used only for season-level aggregation; it never links the payload to a
    concrete match in match_core.
    """
    team_candidates = set()
    for side in ("home", "away"):
        ids = {
            item.get("teamId")
            for item in (lineup.get(side) or {}).get("players", [])
            if isinstance(item.get("teamId"), int)
        }
        for team_id in ids:
            leagues = known_team_leagues.get(team_id, set())
            if len(leagues) == 1:
                team_candidates.update(leagues)
    if len(team_candidates) == 1:
        return next(iter(team_candidates))
    if len(team_candidates) > 1:
        return None

    votes = defaultdict(int)
    total = 0
    for side in ("home", "away"):
        for item in (lineup.get(side) or {}).get("players", []):
            pid = (item.get("player") or {}).get("id")
            leagues = legacy_player_leagues.get(pid, set())
            if len(leagues) == 1:
                votes[next(iter(leagues))] += 1
                total += 1
    if total < 5 or not votes:
        return None
    ranked = sorted(votes.items(), key=lambda item: item[1], reverse=True)
    league, count = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else 0
    if count >= 5 and count / total >= 0.75 and count > runner_up:
        return league
    return None


def rebuild(root=ROOT):
    data = root / "data"
    legacy = load(data / "superliga_stats.json", [])
    events = cached_events(root)

    official_core = load(data / "official_match_core_2026.json", {}) or {}
    official_matches = {
        match["id"]: match
        for match in official_core.get("matches", [])
        if isinstance(match.get("id"), int)
    }
    official_teams = {
        team["id"]: team
        for team in official_core.get("teams", [])
        if isinstance(team.get("id"), int)
    }
    link_payload = load(data / "event_links_2026.json", {}) or {}
    official_links = {
        int(link["eventId"]): link
        for link in link_payload.get("links", [])
        if isinstance(link.get("eventId"), int) and isinstance(link.get("officialMatchId"), int)
    }

    season_contract = {}
    for league, tid in TOURNAMENTS.items():
        seasons = load(data / f"cache/seasons/{league}_{tid}_seasons.json", {}).get("seasons", [])[:2]
        if len(seasons) < 2:
            raise ValueError(f"Two explicit seasons required for {league}")
        season_contract[league] = seasons

    known_team_leagues = defaultdict(set)
    for event in events.values():
        for side in ("home", "away"):
            team_id = (event.get(side + "Team") or {}).get("id")
            if isinstance(team_id, int):
                known_team_leagues[team_id].add(event["league"])

    legacy_player_leagues = defaultdict(set)
    for player in legacy:
        if player.get("league") in TOURNAMENTS and isinstance(player.get("sofaId"), int):
            legacy_player_leagues[player["sofaId"]].add(player["league"])

    profiles = {}
    for path in sorted((data / "cache/players").glob("*.json")):
        payload = load(path)
        profile = payload.get("player") or {}
        if profile.get("id"):
            profiles[profile["id"]] = payload
    appearances = defaultdict(list)
    orphan_current = defaultdict(list)
    observations = defaultdict(list)
    unlinked, missing_lineups, unconfirmed = [], [], []
    inferred_unlinked, unresolved_unlinked = defaultdict(set), []
    linked = set()
    official_linked = set()
    for path in sorted((data / "cache/lineups").glob("*.json")):
        event_id = int(path.stem)
        lineup = load(path)
        if lineup.get("confirmed") is not True:
            unconfirmed.append(event_id)
            continue
        event = events.get(event_id)
        official_link = official_links.get(event_id)
        official_event = official_matches.get(official_link["officialMatchId"]) if official_link else None
        inferred_league = None
        if event is None and official_event is not None:
            if official_event.get("league") != official_link.get("league"):
                raise ValueError(f"Official link league mismatch for event {event_id}")
            if official_event.get("seasonId") != official_link.get("seasonId"):
                raise ValueError(f"Official link season mismatch for event {event_id}")
            official_linked.add(event_id)
        elif event is None:
            unlinked.append(event_id)
            inferred_league = infer_unlinked_lineup_league(lineup, known_team_leagues, legacy_player_leagues)
            if inferred_league:
                inferred_unlinked[inferred_league].add(event_id)
            else:
                unresolved_unlinked.append(event_id)
        else:
            linked.add(event_id)
        for side in ("home", "away"):
            for item in (lineup.get(side) or {}).get("players", []):
                player = item.get("player") or {}
                pid = player.get("id")
                if not isinstance(pid, int):
                    continue
                observed_at = event.get("startTimestamp") if event else official_event.get("date") if official_event else None
                observations[pid].append((observed_at, player))
                stats = item.get("statistics") or {}
                minutes = number(stats.get("minutesPlayed"))
                if minutes is None or minutes <= 0:
                    continue
                if event:
                    team = event.get(side + "Team") or {}
                    # The player-level teamId can refer to a later registration.
                    # Historical membership comes from the event's home/away side.
                    if not team.get("id") or not team.get("name"):
                        raise ValueError(f"Missing event team: {event_id}/{side}")
                    appearances[(event["league"], pid)].append({
                        "eventId": event_id, "matchId": event_id, "seasonId": event["season"]["id"],
                        "date": event["startTimestamp"], "team": team,
                        "player": player, "statistics": stats,
                        "position": POSITION.get(item.get("position") or player.get("position")),
                        "substitute": item.get("substitute") if isinstance(item.get("substitute"), bool) else None,
                    })
                elif official_event is not None:
                    team_id = official_event.get("homeTeamId") if side == "home" else official_event.get("awayTeamId")
                    team = official_teams.get(team_id) or {}
                    if not isinstance(team_id, int) or not team.get("name"):
                        raise ValueError(f"Missing official team for event {event_id}/{side}")
                    appearances[(official_event["league"], pid)].append({
                        "eventId": event_id, "matchId": official_event["id"], "seasonId": official_event["seasonId"],
                        "date": official_event["date"], "team": team,
                        "player": player, "statistics": stats,
                        "position": POSITION.get(item.get("position") or player.get("position")),
                        "substitute": item.get("substitute") if isinstance(item.get("substitute"), bool) else None,
                    })
                elif inferred_league:
                    team_id = item.get("teamId")
                    orphan_current[(inferred_league, pid)].append({
                        "eventId": event_id, "seasonId": season_contract[inferred_league][0]["id"],
                        "date": None, "team": {"id": team_id if isinstance(team_id, int) else None, "name": None},
                        "player": player, "statistics": stats,
                        "position": POSITION.get(item.get("position") or player.get("position")),
                        "substitute": item.get("substitute") if isinstance(item.get("substitute"), bool) else None,
                    })
    missing_lineups = sorted(set(events) - linked)
    # Keep identities even when their historical aggregate cannot be verified.
    identities = {(p["league"], p["sofaId"]): p.get("name") for p in legacy if p.get("league") in TOURNAMENTS}
    identities.update({key: rows[-1]["player"].get("name") for key, rows in appearances.items()})
    identities.update({key: rows[-1]["player"].get("name") for key, rows in orphan_current.items()})
    season_meta = {}
    for league, tid in TOURNAMENTS.items():
        selected = season_contract[league]
        meta = []
        for season in selected:
            sid = season["id"]
            pages = [load(p) for p in sorted((data / "cache/seasons").glob(f"matches_{league}_{sid}_p*.json"))]
            relevant = [e for e in events.values() if e["league"] == league and e["season"]["id"] == sid]
            manifest = load(data / f"cache/seasons/sync_{league}_{sid}.json", {})
            complete = manifest.get("complete") is True and all(e["id"] in linked for e in relevant)
            meta.append({"id": sid, "name": season["name"], "year": season.get("year"),
                         "cachedMatches": sum(e["id"] in linked for e in relevant),
                         "complete": complete, "lastSyncedAt": manifest.get("lastSyncedAt"),
                         "pagesCached": len(pages)})
        season_meta[league] = meta
    output = []
    for (league, pid), name in sorted(identities.items()):
        rows = sorted(appearances.get((league, pid), []), key=lambda a: (a["date"], a["eventId"]))
        cached = profiles.get(pid)
        dated = sorted((o for o in observations[pid] if o[0] is not None), key=lambda o: o[0])
        if cached:
            source = cached["player"]
            source_ref = f"data/cache/players/{pid}.json"
            source_at = cached.get("_cachedAt")
        elif dated:
            source_at, source = dated[-1]
            source_ref = "cached_match_player"
        else:
            # Undated payloads can verify an invariant field, but not which of
            # several conflicting values is the current one.
            sources = [p for _, p in observations[pid]]
            source = {}
            for key in {k for p in sources for k in p}:
                vals = {json.dumps(p[key], sort_keys=True): p[key] for p in sources if p.get(key) is not None}
                if len(vals) == 1:
                    source[key] = next(iter(vals.values()))
            source_ref, source_at = "undated_source_consensus", None
        fields = profile_fields(source)
        current_team = (source.get("team") or {}) if cached else {}
        observed_team = rows[-1]["team"] if rows else {}
        team = current_team or observed_team
        current_id, previous_id = (s["id"] for s in season_meta[league])
        current_linked = [a for a in rows if a["seasonId"] == current_id]
        current_orphan = orphan_current.get((league, pid), [])
        current = current_linked + current_orphan
        previous = [a for a in rows if a["seasonId"] == previous_id]
        country = fields["countryCode"]
        output.append({
            "schemaVersion": 2, "sofaId": pid, "league": league, **fields,
            "name": fields["name"] or name,
            "club": team.get("name"), "clubSource": "profile" if current_team else "last_match" if observed_team else None,
            "clubObservedAt": source_at if current_team else rows[-1]["date"] if rows else None,
            "profileSource": source_ref, "profileObservedAt": source_at,
            "isLegionnaire": country != COUNTRIES[league] if country else None,
            "currentSeasonId": current_id, "previousSeasonId": previous_id,
            "currentSeason": aggregate(current), "previousSeason": aggregate(previous),
            "twoSeasons": aggregate(current + previous),
        })
    report = {
        "schemaVersion": 2, "source": "SofaScore cached payloads",
        "scope": "match history uses source-linked matches; current-season aggregates may also use league-inferred unlinked lineup payloads",
        "leagues": season_meta, "players": len(output),
        "linkedLineups": len(linked), "officialLinkedLineups": len(official_linked),
        "unlinkedLineups": len(unlinked),
        "inferredCurrentSeasonLineups": {league: len(ids) for league, ids in inferred_unlinked.items()},
        "unresolvedUnlinkedLineups": len(unresolved_unlinked),
        "unlinkedEventIds": unlinked, "missingLineupEventIds": missing_lineups,
        "unconfirmedLineupEventIds": unconfirmed,
        "unverifiedLegacyAggregatesExcluded": True,
        "playersWithCurrentStats": sum(p["currentSeason"] is not None for p in output),
        "playersWithCurrentStatsByLeague": {
            league: sum(p["league"] == league and p["currentSeason"] is not None for p in output)
            for league in TOURNAMENTS
        },
        "playersWithPreviousStats": sum(p["previousSeason"] is not None for p in output),
    }
    # Source caches are never deleted or rewritten by the recovery operation.
    # A normalized, reproducible first match store. Raw cache is immutable here.
    core_matches, core_appearances, teams, core_players = [], [], {}, {}
    for event_id, event in sorted(events.items()):
        for side in ("home", "away"):
            team = event.get(side + "Team") or {}
            if isinstance(team.get("id"), int):
                teams[team["id"]] = {"id": team["id"], "name": team.get("name")}
        lineup_path = data / "cache/lineups" / f"{event_id}.json"
        lineup = load(lineup_path, {}) if event_id in linked else {}
        core_matches.append({
            "id": event_id, "league": event["league"], "competitionId": TOURNAMENTS[event["league"]],
            "seasonId": event["season"]["id"], "seasonName": event["season"].get("name"),
            "date": event["startTimestamp"], "homeTeamId": (event.get("homeTeam") or {}).get("id"),
            "awayTeamId": (event.get("awayTeam") or {}).get("id"),
            "homeScore": number((event.get("homeScore") or {}).get("current")),
            "awayScore": number((event.get("awayScore") or {}).get("current")),
            "lineupAvailable": event_id in linked,
            "homeFormation": (lineup.get("home") or {}).get("formation"),
            "awayFormation": (lineup.get("away") or {}).get("formation"),
            "source": "SofaScore", "sourceEventId": event_id,
            "eventHash": hashlib.sha256(json.dumps(event, sort_keys=True).encode()).hexdigest(),
            "lineupHash": hashlib.sha256(lineup_path.read_bytes()).hexdigest() if event_id in linked else None,
            "sourcePath": f"data/cache/lineups/{event_id}.json" if event_id in linked else None,
        })
    seen = set()
    for (league, pid), rows in sorted(appearances.items()):
        for a in rows:
            match_id = a.get("matchId", a["eventId"])
            key = (match_id, pid)
            if key in seen:
                raise ValueError(f"Duplicate appearance {key}")
            seen.add(key)
            core_players[pid] = {"id": pid, "name": a["player"].get("name")}
            core_appearances.append({
                "id": f"{match_id}:{pid}", "matchId": match_id, "playerId": pid,
                "sourceEventId": a["eventId"],
                "teamId": a["team"]["id"], "minutes": a["statistics"]["minutesPlayed"],
                "position": a["position"], "substitute": a["substitute"],
                "stats": {target: number(a["statistics"].get(source)) for target, source in METRICS.items()},
            })
    core = {"schemaVersion": 1, "calculationVersion": "observed-v1", "source": "SofaScore",
            "seasons": season_meta, "teams": list(teams.values()), "players": list(core_players.values()),
            "matches": core_matches, "appearances": core_appearances,
            "officialLinkedEventIds": sorted(official_linked),
            "unlinkedEventIds": sorted(unlinked), "unconfirmedEventIds": sorted(unconfirmed)}
    # Compact derived store avoids duplicating the large provider payloads.
    atomic_gzip(data / "match_core.json.gz", core)
    coverage_report = {}
    for league in TOURNAMENTS:
        league_rows = [a for (l, _), rows in appearances.items() if l == league for a in rows]
        coverage_report[league] = {"appearances": len(league_rows), "metrics": {
            key: {"known": sum(number(a["statistics"].get(src)) is not None for a in league_rows),
                  "missing": sum(number(a["statistics"].get(src)) is None for a in league_rows)}
            for key, src in METRICS.items()}}
    atomic_json(data / "audits/metric_coverage.json", coverage_report)
    observations = {}
    for player in output:
        observations[f"{player['league']}-{player['sofaId']}"] = {
            period: player[period].pop("metricDetails") for period in ("currentSeason", "previousSeason", "twoSeasons") if player[period]
        }
    atomic_gzip(data / "metric_observations.json.gz", observations)
    atomic_json(data / "superliga_stats.json", output)
    atomic_json(data / "audits/data_integrity.json", report)
    return report


if __name__ == "__main__":
    report = rebuild()
    print(json.dumps({k: v for k, v in report.items() if not k.endswith("Ids")}, ensure_ascii=False, indent=2))
