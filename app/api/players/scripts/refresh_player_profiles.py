"""Refresh source profiles with bounded retries and an honest failure status."""
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'scripts'))
from data_integrity import load, atomic_json, rebuild

CACHE_TTL = 24 * 3600


def refresh():
    players = load(ROOT / 'data/superliga_stats.json', [])
    ids = sorted({p['sofaId'] for p in players})
    session = requests.Session(impersonate='chrome120')
    updated, failed, reused, consecutive_failures = 0, 0, 0, 0
    for pid in ids:
        path = ROOT / f'data/cache/players/{pid}.json'
        cached = load(path, {})
        if time.time() - cached.get('_cachedAt', 0) < CACHE_TTL and cached.get('player'):
            reused += 1
            continue
        profile = None
        for attempt in range(2):
            try:
                response = session.get(f'https://www.sofascore.com/api/v1/player/{pid}', timeout=10)
                if response.status_code == 200:
                    candidate = response.json().get('player')
                    if isinstance(candidate, dict) and candidate.get('id') == pid:
                        profile = candidate
                        break
                if response.status_code in (401, 403, 429):
                    break
            except Exception:
                pass
            time.sleep(attempt + 1)
        if profile:
            atomic_json(path, {'_cachedAt': time.time(), 'player': profile})
            updated += 1
            consecutive_failures = 0
        else:
            failed += 1
            consecutive_failures += 1
            # Keep the previous source snapshot; don't turn a failed fetch into
            # an empty profile or spend hours retrying a blocked endpoint.
            if consecutive_failures >= 10:
                break
        time.sleep(0.15)
    processed = updated + failed + reused
    status = 'success' if failed == 0 and processed == len(ids) else 'partial' if updated else 'failed'
    report = {'status': status, 'attemptedAt': datetime.now(timezone.utc).isoformat(),
              'total': len(ids), 'updated': updated, 'cached': reused,
              'failed': failed, 'notAttempted': len(ids) - processed}
    atomic_json(ROOT / 'data/audits/profile_sync_status.json', report)
    print(report)
    if updated or reused:
        rebuild(ROOT)
    if status != 'success':
        raise RuntimeError(f'Profile sync {status}: {failed} failures, {len(ids) - processed} not attempted')


if __name__ == '__main__':
    refresh()
