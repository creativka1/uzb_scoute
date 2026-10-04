#!/usr/bin/env python3
"""Build a 2026 match-only core from official league match pages.

This layer intentionally contains only competition facts needed by the match
centre: teams, dates, scores, rounds and match IDs. Player appearances and
advanced match statistics remain in the existing player-level data pipeline.

Sources:
- Uzbekistan: https://pfl.uz/en/match/<id>
- Kazakhstan: https://kffleague.kz/ru/matches/<id>
"""
from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import re
import time
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "official_match_core_2026.json"
AUDIT = ROOT / "data" / "audits" / "official_2026_sync_status.json"

SEASONS = {
    "UZB": {"id": 89354, "name": "Superliga 2026", "year": "2026", "competitionId": 772},
    "KAZ": {"id": 90730, "name": "Premier League 2026", "year": "2026", "competitionId": 682},
}
SCAN = {
    "UZB": {"start": 3780, "end": 4240, "base": "https://pfl.uz/en/match/{}"},
    "KAZ": {"start": 880, "end": 1130, "base": "https://kffleague.kz/ru/matches/{}"},
}
TEAM_PREFIX = {"UZB": 100_000_000, "KAZ": 300_000_000}
MATCH_PREFIX = {"UZB": 30_000_000, "KAZ": 40_000_000}
RU_MONTHS = {
    "янв": 1, "января": 1,
    "фев": 2, "февраля": 2,
    "мар": 3, "марта": 3,
    "апр": 4, "апреля": 4,
    "май": 5, "мая": 5,
    "июн": 6, "июня": 6,
    "июл": 7, "июля": 7,
    "авг": 8, "августа": 8,
    "сен": 9, "сент": 9, "сентября": 9,
    "окт": 10, "октября": 10,
    "ноя": 11, "ноября": 11,
    "дек": 12, "декабря": 12,
}


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs):
        if tag.lower() in {"script", "style"}:
            self._ignored_depth += 1

    def handle_endtag(self, tag: str):
        if tag.lower() in {"script", "style"} and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str):
        if self._ignored_depth:
            return
        value = html_lib.unescape(data).strip()
        if value:
            self.parts.append(re.sub(r"\s+", " ", value))


def text_parts(html: str) -> list[str]:
    parser = TextExtractor()
    parser.feed(html)
    return parser.parts


def normalize_team(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip()


def stable_team_id(league: str, name: str) -> int:
    normalized = normalize_team(name).casefold().encode("utf-8")
    return TEAM_PREFIX[league] + (zlib.crc32(normalized) & 0x07FFFFFF)


def event_hash(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def fetch(url: str, timeout: int = 15, attempts: int = 3) -> str | None:
    headers = {
        "User-Agent": "UzStatMatchSync/1.0 (+https://github.com/creativka1/uzb_scoute)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
    }
    for attempt in range(attempts):
        req = Request(url, headers=headers)
        try:
            with urlopen(req, timeout=timeout) as response:
                if response.status == 200:
                    return response.read().decode("utf-8", errors="replace")
                if response.status not in {429, 500, 502, 503, 504}:
                    return None
        except HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504}:
                return None
        except (URLError, TimeoutError):
            pass
        if attempt + 1 < attempts:
            time.sleep(0.35 * (attempt + 1))
    return None


def parse_pfl(html: str, source_id: int) -> dict | None:
    parts = text_parts(html)
    marker_index = next((i for i, s in enumerate(parts) if re.fullmatch(r"Superleague MW\d+", s)), None)
    if marker_index is None:
        return None
    round_match = re.fullmatch(r"Superleague MW(\d+)", parts[marker_index])
    if not round_match:
        return None

    segment = parts[marker_index:marker_index + 24]
    date_index = next((i for i, s in enumerate(segment) if re.fullmatch(
        r"Kick-off time \d{2}\.\d{2}\.2026, \d{2}:\d{2}", s)), None)
    score_index = next((i for i, s in enumerate(segment) if re.fullmatch(r"\d+\s*-\s*\d+", s)), None)
    if date_index is None or score_index is None or score_index == 0 or score_index + 1 >= len(segment):
        return None

    date_match = re.search(r"(\d{2})\.(\d{2})\.(2026), (\d{2}):(\d{2})", segment[date_index])
    if not date_match:
        return None
    day, month, year, hour, minute = map(int, date_match.groups())
    kickoff = int(datetime(year, month, day, hour, minute, tzinfo=ZoneInfo("Asia/Tashkent")).timestamp())

    home = normalize_team(segment[score_index - 1])
    finished = "Finished" in segment[score_index + 1:score_index + 5]
    technical_defeat = False
    if finished:
        finished_index = segment.index("Finished", score_index + 1)
        if finished_index + 1 >= len(segment):
            return None
        next_value = normalize_team(segment[finished_index + 1])
        if next_value.casefold() == "technical defeat":
            technical_defeat = True
            if finished_index + 2 >= len(segment):
                return None
            away = normalize_team(segment[finished_index + 2])
        else:
            away = next_value
    else:
        away = normalize_team(segment[score_index + 1])

    if not home or not away or home == away:
        return None
    score = re.fullmatch(r"(\d+)\s*-\s*(\d+)", segment[score_index])
    # A technical defeat page can display a placeholder score. Keep the teams
    # but do not turn that placeholder into a sporting result.
    home_score = int(score.group(1)) if finished and score and not technical_defeat else None
    away_score = int(score.group(2)) if finished and score and not technical_defeat else None

    return {
        "sourceId": source_id,
        "round": int(round_match.group(1)),
        "date": kickoff,
        "home": home,
        "away": away,
        "homeScore": home_score,
        "awayScore": away_score,
        "finished": finished,
        "url": SCAN["UZB"]["base"].format(source_id),
    }


def parse_ru_date(value: str, time_value: str) -> int | None:
    match = re.search(r"(\d{1,2})\s+([а-яё]+)\.?,?\s+(2026)\s*г\.?", value.casefold())
    clock = re.fullmatch(r"(\d{1,2}):(\d{2})", time_value)
    if not match or not clock:
        return None
    day = int(match.group(1))
    month_key = match.group(2).rstrip(".")
    month = RU_MONTHS.get(month_key)
    if month is None:
        return None
    hour, minute = map(int, clock.groups())
    return int(datetime(2026, month, day, hour, minute, tzinfo=ZoneInfo("Asia/Almaty")).timestamp())


def kff_completed_from_title(parts: list[str]) -> tuple[str, int, int, str, str] | None:
    """Return home, homeScore, awayScore, away, dateText from KFF SEO title."""
    for value in parts:
        if "КПЛ" not in value or "2026" not in value or ":" not in value:
            continue
        match = re.search(
            r"^(.+?)\s+(\d+)\s*:\s*(\d+)\s+(.+?)\s+[—–-]\s+КПЛ,\s+(.+?2026\s*г\.?)",
            value,
        )
        if match:
            return (
                normalize_team(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
                normalize_team(match.group(4)),
                match.group(5),
            )
    return None


def parse_kff(html: str, source_id: int) -> dict | None:
    parts = text_parts(html)

    marker_index = next((i for i, s in enumerate(parts)
                         if re.fullmatch(r"Премьер-Лига 2026, \d+ тур", s)), None)
    marker = re.fullmatch(r"Премьер-Лига 2026, (\d+) тур", parts[marker_index]) if marker_index is not None else None
    title_match = kff_completed_from_title(parts)
    if marker is None and title_match is None:
        return None

    # Find a visible body date + kickoff time. Never invent a kickoff time from
    # an SEO title because it does not reliably contain one.
    date_indices = [
        i for i, value in enumerate(parts)
        if re.search(r"\d{1,2}\s+[а-яё]+\.?\s+2026\s*г\.?", value.casefold())
        and "КПЛ," not in value
    ]
    kickoff = None
    kickoff_index = None
    for date_index in date_indices:
        time_index = next((
            i for i in range(date_index + 1, min(len(parts), date_index + 7))
            if re.fullmatch(r"\d{1,2}:\d{2}", parts[i])
        ), None)
        if time_index is not None:
            kickoff = parse_ru_date(parts[date_index], parts[time_index])
            if kickoff is not None:
                kickoff_index = time_index
                break
    if kickoff is None or kickoff_index is None:
        return None

    round_no = int(marker.group(1)) if marker else 0

    if title_match is not None:
        home, home_score, away_score, away, _ = title_match
        if not home or not away or home == away:
            return None
        return {
            "sourceId": source_id,
            "round": round_no,
            "date": kickoff,
            "home": home,
            "away": away,
            "homeScore": home_score,
            "awayScore": away_score,
            "finished": True,
            "url": SCAN["KAZ"]["base"].format(source_id),
        }

    # Fallback for pages where the completed score is present in body text but
    # not exposed in the SEO title. Search only after the kickoff time so 16:00
    # can never be mistaken for a football score.
    search_end = min(len(parts), kickoff_index + 12)
    score_index = next((
        i for i in range(kickoff_index + 1, search_end)
        if re.fullmatch(r"(?:\d+\s*:\s*\d+|-\s*:\s*-)", parts[i])
    ), None)
    if score_index is None or score_index == 0 or score_index + 1 >= len(parts):
        return None

    home = normalize_team(parts[score_index - 1])
    away = normalize_team(parts[score_index + 1])
    if not home or not away or home == away:
        return None

    score = re.fullmatch(r"(\d+)\s*:\s*(\d+)", parts[score_index])
    upcoming = parts[score_index].replace(" ", "") == "-:-" or any(
        s == "Предстоящий" for s in parts[max(0, score_index - 8):score_index + 1]
    )
    return {
        "sourceId": source_id,
        "round": round_no,
        "date": kickoff,
        "home": home,
        "away": away,
        "homeScore": None if upcoming or score is None else int(score.group(1)),
        "awayScore": None if upcoming or score is None else int(score.group(2)),
        "finished": bool(score is not None and not upcoming),
        "url": SCAN["KAZ"]["base"].format(source_id),
    }

def scan_one(league: str, source_id: int) -> dict | None:
    html = fetch(SCAN[league]["base"].format(source_id))
    if not html:
        return None
    parsed = parse_pfl(html, source_id) if league == "UZB" else parse_kff(html, source_id)
    if parsed is not None:
        return parsed

    parts = text_parts(html)
    if league == "KAZ":
        has_marker = any(re.fullmatch(r"Премьер-Лига 2026, \d+ тур", part) for part in parts)
        has_date = any(re.search(r"\d{1,2}\s+[а-яё]+\.?\s+2026\s*г\.?", part.casefold()) for part in parts)
        has_time = any(re.fullmatch(r"\d{1,2}:\d{2}", part) for part in parts)
        if has_marker and has_date and has_time:
            raise RuntimeError(f"Could not parse confirmed KFF 2026 match page {source_id}")
    return None


def scan_league(league: str, workers: int) -> list[dict]:
    cfg = SCAN[league]
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(scan_one, league, source_id): source_id
                   for source_id in range(cfg["start"], cfg["end"] + 1)}
        for future in as_completed(futures):
            try:
                item = future.result()
            except Exception:
                item = None
            if item:
                results.append(item)
    return sorted(results, key=lambda x: (x["date"], x["sourceId"]))


def build(leagues: list[str], workers: int):
    generated_at = datetime.now(tz=ZoneInfo("UTC")).isoformat()
    teams_by_id: dict[int, dict] = {}
    matches: list[dict] = []
    season_meta = {"UZB": [], "KAZ": []}
    audit = {"status": "running", "generatedAt": generated_at, "leagues": {}}

    for league in leagues:
        rows = scan_league(league, workers)
        if not rows:
            raise RuntimeError(f"No official 2026 matches parsed for {league}")
        seen_team_ids: dict[int, str] = {}
        for row in rows:
            home_id = stable_team_id(league, row["home"])
            away_id = stable_team_id(league, row["away"])
            for team_id, name in ((home_id, row["home"]), (away_id, row["away"])):
                existing = seen_team_ids.get(team_id)
                if existing and existing != name:
                    raise RuntimeError(f"Team ID collision: {existing!r} vs {name!r}")
                seen_team_ids[team_id] = name
                teams_by_id[team_id] = {"id": team_id, "name": name}

            season = SEASONS[league]
            normalized = {
                "id": MATCH_PREFIX[league] + row["sourceId"],
                "league": league,
                "competitionId": season["competitionId"],
                "seasonId": season["id"],
                "seasonName": season["name"],
                "date": row["date"],
                "homeTeamId": home_id,
                "awayTeamId": away_id,
                "homeScore": row["homeScore"],
                "awayScore": row["awayScore"],
                "lineupAvailable": False,
                "homeFormation": None,
                "awayFormation": None,
                "source": "official-league",
                "sourceEventId": row["sourceId"],
                "eventHash": "",
                "lineupHash": None,
                "sourcePath": row["url"],
                "round": row["round"],
            }
            normalized["eventHash"] = event_hash({k: v for k, v in normalized.items() if k != "eventHash"})
            matches.append(normalized)

        season_meta[league] = [{
            "id": SEASONS[league]["id"],
            "name": SEASONS[league]["name"],
            "year": "2026",
            "cachedMatches": len(rows),
            "complete": False,
            "lastSyncedAt": generated_at,
        }]
        audit["leagues"][league] = {
            "matches": len(rows),
            "finished": sum(1 for row in rows if row["finished"]),
            "scheduledWithConfirmedTime": sum(1 for row in rows if not row["finished"]),
            "teams": len(seen_team_ids),
            "sourceIdMin": min(row["sourceId"] for row in rows),
            "sourceIdMax": max(row["sourceId"] for row in rows),
        }
        time.sleep(0.2)

    payload = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "source": "official-league-match-pages",
        "seasons": season_meta,
        "teams": sorted(teams_by_id.values(), key=lambda x: x["id"]),
        "matches": sorted(matches, key=lambda x: (x["date"], x["id"])),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit["status"] = "success"
    AUDIT.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--league", action="append", choices=sorted(SEASONS),
                        help="Repeat to restrict; default is both leagues")
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    build(args.league or ["UZB", "KAZ"], max(1, min(args.workers, 8)))
