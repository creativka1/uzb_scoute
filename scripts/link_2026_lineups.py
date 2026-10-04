#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_PATH = ROOT / "data" / "official_match_core_2026.json"
OUT_PATH = ROOT / "data" / "event_links_2026.json"
AUDIT_PATH = ROOT / "data" / "audits" / "event_linking_2026.json"

TOURNAMENTS = {"UZB": 772, "KAZ": 682}

ALIASES = {
    "UZB": {
        "pakhtakor tashkent": "Pakhtakor",
        "fc bunyodkor": "Bunyodkor",
        "fk kokand 1912": "Qo'qon-1912",
        "fc buxoro": "Bukhoro",
        "neftchi fergana": "Neftchi",
        "fc okmk": "OKMK",
        "navbahor namangan": "Navbahor",
        "dinamo samarqand": "Dinamo",
        "nasaf qarshi": "Nasaf",
        "pfk qizilqum": "Qizilqum",
        "fc andijon": "Andijan",
        "pfk xorazm": "Xorazm",
        "fc sogdiana jizzakh": "Sogdiyona",
        "surkhon termez": "Surkhon",
        "mash al mubarek": "Mashal",
    },
    "KAZ": {
        "fc ordabasy": "Ордабасы",
        "fk zhenys": "Женис",
        "ulytau fc": "Улытау",
        "fc kairat almaty": "Кайрат",
        "fk aktobe": "Актобе",
        "astana": "Астана",
        "yelimay semey": "Елимай",
        "zhetysu taldykorgan": "Жетысу",
        "fc kaysar": "Кайсар",
        "fc tobyl": "Тобыл",
        "atyrau": "Атырау",
        "fc kyzylzhar": "Кызылжар",
        "oqjetpes fk": "Окжетпес",
    },
}


def load(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def atomic_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(text, encoding="utf-8")
    temp.replace(path)


def norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9а-яёқғҳў]+", " ", (value or "").lower())).strip()


def cached_team_names():
    result = defaultdict(dict)
    seasons_dir = ROOT / "data" / "cache" / "seasons"
    for league, tournament_id in TOURNAMENTS.items():
        for path in sorted(seasons_dir.glob(f"matches_{league}_*.json")):
            payload = load(path, {})
            for event in payload.get("events", payload.get("matches", [])):
                unique = ((event.get("tournament") or {}).get("uniqueTournament") or {}).get("id")
                if unique != tournament_id:
                    continue
                for side in ("homeTeam", "awayTeam"):
                    team = event.get(side) or {}
                    if isinstance(team.get("id"), int) and team.get("name"):
                        result[league][team["id"]] = team["name"]
    return result


def dominant_team_id(side: dict) -> tuple[int | None, int, int]:
    players = side.get("players") or []
    ids = [item.get("teamId") for item in players if isinstance(item.get("teamId"), int)]
    if not ids:
        return None, 0, 0
    team_id, count = Counter(ids).most_common(1)[0]
    # Transfers can leave one or two players carrying another current-team ID.
    if count < 5 or count / len(ids) < 0.60:
        return None, count, len(ids)
    return team_id, count, len(ids)


def inferred_score(lineup: dict) -> tuple[int, int]:
    def goals(side: str) -> int:
        return sum(
            int((item.get("statistics") or {}).get("goals") or 0)
            for item in (lineup.get(side) or {}).get("players", [])
        )
    def own(side: str) -> int:
        return sum(
            int((item.get("statistics") or {}).get("ownGoals") or 0)
            for item in (lineup.get(side) or {}).get("players", [])
        )
    # Opponent own goals count for this side.
    return goals("home") + own("away"), goals("away") + own("home")


def official_index(payload: dict):
    teams = {team["id"]: team["name"] for team in payload.get("teams", [])}
    by_league = defaultdict(list)
    for match in payload.get("matches", []):
        if match.get("league") not in TOURNAMENTS:
            continue
        by_league[match["league"]].append({
            **match,
            "homeName": teams.get(match.get("homeTeamId")),
            "awayName": teams.get(match.get("awayTeamId")),
        })
    return teams, by_league


def initial_team_mapping(known_names: dict, official_teams: dict):
    official_name_set = set(official_teams.values())
    mapping = defaultdict(dict)
    evidence = []
    for league, team_names in known_names.items():
        aliases = ALIASES[league]
        for sofa_id, sofa_name in team_names.items():
            target = aliases.get(norm(sofa_name))
            if target and target in official_name_set:
                mapping[league][sofa_id] = target
                evidence.append({
                    "league": league,
                    "sofaTeamId": sofa_id,
                    "sofaName": sofa_name,
                    "officialName": target,
                    "method": "verified-previous-season-name",
                })
    return mapping, evidence


def lineup_records(team_mapping, known_team_names):
    records = []
    lineup_dir = ROOT / "data" / "cache" / "lineups"
    for path in sorted(lineup_dir.glob("*.json")):
        event_id = int(path.stem)
        lineup = load(path, {})
        if lineup.get("confirmed") is not True:
            continue
        home_id, home_count, home_total = dominant_team_id(lineup.get("home") or {})
        away_id, away_count, away_total = dominant_team_id(lineup.get("away") or {})
        if home_id is None or away_id is None or home_id == away_id:
            continue

        # Determine league from previously verified team IDs first.
        league_candidates = set()
        for league in TOURNAMENTS:
            if home_id in known_team_names[league] or away_id in known_team_names[league]:
                league_candidates.add(league)
            if home_id in team_mapping[league] or away_id in team_mapping[league]:
                league_candidates.add(league)
        if len(league_candidates) != 1:
            # Fall back to player-country majority only for league classification,
            # never for team identity.
            votes = Counter()
            for side in ("home", "away"):
                for item in (lineup.get(side) or {}).get("players", []):
                    country = ((item.get("player") or {}).get("country") or {}).get("alpha2")
                    if country == "UZ":
                        votes["UZB"] += 1
                    elif country == "KZ":
                        votes["KAZ"] += 1
            if votes:
                top, count = votes.most_common(1)[0]
                if count >= 6 and (len(votes) == 1 or count >= 2 * votes.most_common(2)[1][1]):
                    league_candidates = {top}
        if len(league_candidates) != 1:
            continue

        league = next(iter(league_candidates))
        records.append({
            "eventId": event_id,
            "league": league,
            "homeSofaTeamId": home_id,
            "awaySofaTeamId": away_id,
            "homeDominance": [home_count, home_total],
            "awayDominance": [away_count, away_total],
            "score": list(inferred_score(lineup)),
        })
    return records


def candidate_matches(record, official_matches, mapping, used_official_names=None):
    league = record["league"]
    home_name = mapping[league].get(record["homeSofaTeamId"])
    away_name = mapping[league].get(record["awaySofaTeamId"])
    home_score, away_score = record["score"]

    candidates = []
    for match in official_matches[league]:
        if home_name and match["homeName"] != home_name:
            continue
        if away_name and match["awayName"] != away_name:
            continue
        # A lineup with player statistics is a played match. If the official
        # source has a score, require it to agree with the player-goal total.
        if match.get("homeScore") is not None and match.get("awayScore") is not None:
            if [match["homeScore"], match["awayScore"]] != [home_score, away_score]:
                continue
        candidates.append(match)
    return candidates


def infer_missing_team_mappings(records, official_matches, mapping):
    # Iterate constraint intersections. An unknown Sofa team can be identified
    # when all of its usable matches point to the same remaining official team.
    changed = True
    while changed:
        changed = False
        used = {league: set(values.values()) for league, values in mapping.items()}
        possible = defaultdict(lambda: None)

        for record in records:
            league = record["league"]
            for side in ("home", "away"):
                sofa_key = f"{side}SofaTeamId"
                sofa_id = record[sofa_key]
                if sofa_id in mapping[league]:
                    continue
                other = "away" if side == "home" else "home"
                other_id = record[f"{other}SofaTeamId"]
                other_name = mapping[league].get(other_id)
                if not other_name:
                    continue

                score = record["score"]
                options = set()
                for match in official_matches[league]:
                    if side == "home":
                        if match["awayName"] != other_name:
                            continue
                        candidate_name = match["homeName"]
                    else:
                        if match["homeName"] != other_name:
                            continue
                        candidate_name = match["awayName"]
                    if match.get("homeScore") is not None and match.get("awayScore") is not None:
                        if [match["homeScore"], match["awayScore"]] != score:
                            continue
                    if candidate_name in used[league]:
                        continue
                    options.add(candidate_name)

                if not options:
                    continue
                key = (league, sofa_id)
                if possible[key] is None:
                    possible[key] = options
                else:
                    possible[key] &= options

        for (league, sofa_id), options in list(possible.items()):
            if options and len(options) == 1:
                value = next(iter(options))
                mapping[league][sofa_id] = value
                changed = True

        # Last-team elimination is safe only if the counts match one-to-one.
        for league in TOURNAMENTS:
            sofa_ids = {
                record["homeSofaTeamId"] for record in records if record["league"] == league
            } | {
                record["awaySofaTeamId"] for record in records if record["league"] == league
            }
            unknown_sofa = sofa_ids - set(mapping[league])
            official_names = {
                m["homeName"] for m in official_matches[league]
            } | {
                m["awayName"] for m in official_matches[league]
            }
            unknown_official = official_names - set(mapping[league].values())
            if len(unknown_sofa) == len(unknown_official) == 1:
                mapping[league][next(iter(unknown_sofa))] = next(iter(unknown_official))
                changed = True
    return mapping


def link_events(records, official_matches, mapping):
    links = []
    ambiguous = []
    unmatched = []
    used_match_ids = set()

    for record in records:
        league = record["league"]
        if record["homeSofaTeamId"] not in mapping[league] or record["awaySofaTeamId"] not in mapping[league]:
            unmatched.append({**record, "reason": "unmapped-team"})
            continue

        candidates = candidate_matches(record, official_matches, mapping)
        # Ordered home/away pair in a league season should identify one fixture.
        # Keep score as a consistency check; never force a duplicate.
        candidates = [m for m in candidates if m["id"] not in used_match_ids]
        if len(candidates) == 1:
            match = candidates[0]
            used_match_ids.add(match["id"])
            links.append({
                "eventId": record["eventId"],
                "league": league,
                "officialMatchId": match["id"],
                "seasonId": match["seasonId"],
                "date": match["date"],
                "homeSofaTeamId": record["homeSofaTeamId"],
                "awaySofaTeamId": record["awaySofaTeamId"],
                "homeOfficialTeamId": match["homeTeamId"],
                "awayOfficialTeamId": match["awayTeamId"],
                "homeName": match["homeName"],
                "awayName": match["awayName"],
                "homeScore": match.get("homeScore"),
                "awayScore": match.get("awayScore"),
            })
        elif len(candidates) > 1:
            ambiguous.append({
                **record,
                "candidateOfficialMatchIds": [m["id"] for m in candidates],
            })
        else:
            unmatched.append({**record, "reason": "no-official-match"})
    return links, ambiguous, unmatched


def main():
    official = load(OFFICIAL_PATH)
    if not official or official.get("schemaVersion") != 1:
        raise RuntimeError("official_match_core_2026.json is missing or invalid")

    official_teams, official_matches = official_index(official)
    known_names = cached_team_names()
    mapping, mapping_evidence = initial_team_mapping(known_names, official_teams)
    records = lineup_records(mapping, known_names)
    mapping = infer_missing_team_mappings(records, official_matches, mapping)
    links, ambiguous, unmatched = link_events(records, official_matches, mapping)

    payload = {
        "schemaVersion": 1,
        "generatedFrom": "cached-lineups + official-match-core",
        "links": links,
    }
    audit = {
        "schemaVersion": 1,
        "lineupRecordsConsidered": len(records),
        "linked": len(links),
        "ambiguous": len(ambiguous),
        "unmatched": len(unmatched),
        "teamMapping": {
            league: [
                {
                    "sofaTeamId": sofa_id,
                    "officialName": official_name,
                    "previousName": known_names[league].get(sofa_id),
                }
                for sofa_id, official_name in sorted(values.items())
            ]
            for league, values in mapping.items()
        },
        "initialMappingEvidence": mapping_evidence,
        "ambiguousEvents": ambiguous,
        "unmatchedEvents": unmatched,
    }

    atomic_json(OUT_PATH, payload)
    atomic_json(AUDIT_PATH, audit)
    print(json.dumps({
        "linked": len(links),
        "ambiguous": len(ambiguous),
        "unmatched": len(unmatched),
        "mappedTeams": {league: len(values) for league, values in mapping.items()},
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
