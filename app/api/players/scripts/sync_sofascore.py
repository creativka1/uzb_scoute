"""Download both leagues without replacing missing football data with defaults."""
from __future__ import annotations
import argparse
import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'scripts'))
from data_integrity import TOURNAMENTS, load, atomic_json, rebuild

HOST = 'sofascore.p.rapidapi.com'


def sync(max_requests=1500, delay=1.0, league_filter=None, season_year=None):
    key = os.environ.get('RAPIDAPI_KEY', '').strip()
    if not key:
        raise RuntimeError('RAPIDAPI_KEY is not configured')
    session = requests.Session(impersonate='chrome120')
    headers = {'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST}
    calls = 0

    def fetch(endpoint, params):
        nonlocal calls
        for attempt in range(3):
            if calls >= max_requests:
                raise RuntimeError('Request budget exhausted; existing serving data retained')
            calls += 1
            response = session.get(f'https://{HOST}/{endpoint}', headers=headers, params=params, timeout=30)
            if response.status_code == 200:
                payload = response.json()
                if not isinstance(payload, dict):
                    raise RuntimeError('Invalid provider payload')
                time.sleep(delay)
                return payload
            if response.status_code in (401, 403):
                raise RuntimeError(f'Provider access failed: HTTP {response.status_code}')
            if response.status_code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f'Provider request failed: HTTP {response.status_code}')
            time.sleep(min(30, 3 * (attempt + 1)))
        raise RuntimeError('Provider retry limit reached')

    now = datetime.now(timezone.utc).isoformat()
    selected_tournaments = {
        league: tid for league, tid in TOURNAMENTS.items()
        if not league_filter or league == league_filter
    }
    if not selected_tournaments:
        raise RuntimeError(f'Unknown league filter: {league_filter}')

    for league, tid in selected_tournaments.items():
        base = ROOT / 'data/cache/seasons'
        seasons = fetch('tournaments/get-seasons', {'tournamentId': tid})
        if len(seasons.get('seasons', [])) < 2:
            raise RuntimeError(f'Incomplete season response for {league}')
        atomic_json(base / f'{league}_{tid}_seasons.json', seasons)

        target_seasons = seasons['seasons'][:2]
        if season_year is not None:
            target_seasons = [
                season for season in seasons['seasons']
                if str(season.get('year')) == str(season_year)
            ]
            if not target_seasons:
                raise RuntimeError(f'Season {season_year} not found for {league}')

        for season in target_seasons:
            sid = season['id']
            seen = set()
            # Invalidate old completeness before fetching: a failed refresh must
            # never leave a newly partial cache marked as complete.
            atomic_json(base / f'sync_{league}_{sid}.json', {'complete': False, 'attemptedAt': now})
            for page in range(100):
                payload = fetch('tournaments/get-matches', {'tournamentId': tid, 'seasonId': sid, 'pageIndex': page})
                events = payload.get('events', payload.get('matches'))
                if not isinstance(events, list) or not isinstance(payload.get('hasNextPage'), bool):
                    raise RuntimeError(f'Unverifiable pagination for {league}/{sid}')
                if any((e.get('season') or {}).get('id') != sid or
                       ((e.get('tournament') or {}).get('uniqueTournament') or {}).get('id') != tid
                       for e in events):
                    raise RuntimeError(f'Wrong competition/season response for {league}/{sid}')
                ids = {e['id'] for e in events}
                if ids and not (ids - seen):
                    raise RuntimeError('Provider repeated a page; refusing a truncated season')
                seen.update(ids)
                atomic_json(base / f'matches_{league}_{sid}_p{page}.json', payload)
                for event in events:
                    if event.get('status', {}).get('type') != 'finished':
                        continue
                    target = ROOT / f"data/cache/lineups/{event['id']}.json"
                    existing = load(target)
                    recent = time.time() - event.get('startTimestamp', 0) < 7 * 86400
                    if existing and existing.get('confirmed') is True and not recent:
                        continue
                    lineup = fetch('matches/get-lineups', {'matchId': event['id']})
                    if lineup.get('confirmed') is not True or not all(isinstance(lineup.get(side, {}).get('players'), list) and lineup[side]['players'] for side in ('home', 'away')):
                        raise RuntimeError(f"Invalid lineup for event {event['id']}")
                    atomic_json(target, lineup)
                if not payload['hasNextPage']:
                    # Old tail pages can contain obsolete duplicates. Keep raw
                    # files, but record the current pagination boundary.
                    atomic_json(base / f'sync_{league}_{sid}.json', {
                        'complete': True, 'lastSyncedAt': now, 'pages': page + 1,
                    })
                    break
            else:
                raise RuntimeError('Pagination safety limit reached')
    report = rebuild(ROOT)
    atomic_json(ROOT / 'data/audits/statistics_sync_status.json', {
        'status': 'success', 'updatedAt': now, 'requestsMade': calls,
        'linkedLineups': report['linkedLineups'],
    })


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--max-requests', type=int, default=1500)
    parser.add_argument('--delay', type=float, default=1)
    parser.add_argument('--league', choices=sorted(TOURNAMENTS), default=None,
                        help='Optional league code, e.g. UZB or KAZ')
    parser.add_argument('--season-year', type=int, default=None,
                        help='Optional season year, e.g. 2026')
    args = parser.parse_args()
    try:
        sync(args.max_requests, max(0, args.delay), args.league, args.season_year)
    except Exception as error:
        atomic_json(ROOT / 'data/audits/statistics_sync_status.json', {
            'status': 'failed', 'updatedAt': datetime.now(timezone.utc).isoformat(),
            'error': str(error),
        })
        raise
