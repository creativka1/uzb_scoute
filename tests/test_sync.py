"""Synthetic provider fixtures; HTTP is mocked and production caches are untouched."""
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]


def load_script(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    # Unit tests do not need the real HTTP client or its installation.
    with patch.dict('sys.modules', {'curl_cffi': types.SimpleNamespace(requests=types.SimpleNamespace(Session=Mock()))}):
        spec.loader.exec_module(module)
    return module


syncer = load_script('syncer', 'app/api/players/scripts/sync_sofascore.py')
heatmaps = load_script('heatmaps', 'scripts/sync_sofascore_heatmaps.py')
positions = load_script('positions', 'scripts/build_detailed_positions.py')


class SyncTests(unittest.TestCase):
    def test_heatmap_retry_budget_counts_http_attempts(self):
        response = types.SimpleNamespace(status_code=429, headers={})
        session = Mock()
        session.get.return_value = response
        with patch.object(heatmaps.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
            for budget in (1, 2, 3, 5):
                session.reset_mock()
                status, payload, exhausted, attempts = heatmaps.fetch_heatmap(session, {}, 1, 2, budget)
                self.assertEqual(attempts, min(3, budget))
                self.assertEqual(session.get.call_count, attempts)
                self.assertEqual(status, 429)
                self.assertTrue(exhausted)
                self.assertIsNone(payload)

    def test_heatmap_network_failure_and_invalid_points(self):
        session = Mock()
        session.get.side_effect = RuntimeError('synthetic network failure')
        self.assertEqual(heatmaps.fetch_heatmap(session, {}, 1, 2, 3), (0, None, False, 1))
        self.assertEqual(heatmaps.valid_points({'heatmap': [
            {'x': 0, 'y': 100}, {'x': True, 'y': 1}, {'x': float('nan'), 'y': 0}, {'x': 101, 'y': 0}
        ]}), [{'x': 0, 'y': 100}])

    def run_sync(self, root, callback, budget=100):
        session = Mock()
        session.get.side_effect = lambda url, **kw: types.SimpleNamespace(status_code=200, json=lambda: callback(url, kw['params']))
        with patch.object(syncer, 'ROOT', root), patch.object(syncer.requests, 'Session', return_value=session), \
                patch.object(syncer, 'rebuild', return_value={'linkedLineups': 0}), \
                patch.object(syncer.time, 'sleep'), patch.dict(os.environ, {'RAPIDAPI_KEY': 'unit-test-only'}):
            syncer.sync(budget, 0)
        return session

    @staticmethod
    def provider(url, params):
        if url.endswith('get-seasons'):
            return {'seasons': [{'id': 2}, {'id': 1}]}
        page = params['pageIndex']
        return {'events': [{'id': params['tournamentId'] * 1000 + params['seasonId'] * 10 + page,
                            'season': {'id': params['seasonId']},
                            'tournament': {'uniqueTournament': {'id': params['tournamentId']}},
                            'status': {'type': 'notstarted'}}], 'hasNextPage': page < 3}

    def test_both_leagues_all_pages_and_completeness(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            session = self.run_sync(root, self.provider)
            self.assertEqual(session.get.call_count, 18)  # two season lists + 2 leagues * 2 seasons * 4 pages
            for league in ('UZB', 'KAZ'):
                for sid in (1, 2):
                    manifest = json.loads((root / f'data/cache/seasons/sync_{league}_{sid}.json').read_text())
                    self.assertTrue(manifest['complete'])
                    self.assertEqual(manifest['pages'], 4)
                    self.assertTrue((root / f'data/cache/seasons/matches_{league}_{sid}_p3.json').exists())

    def test_budget_exhaustion_leaves_incomplete_checkpoint(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with self.assertRaisesRegex(RuntimeError, 'budget exhausted'):
                self.run_sync(root, self.provider, 2)
            state = json.loads((root / 'data/cache/seasons/sync_UZB_2.json').read_text())
            self.assertFalse(state['complete'])
            self.assertTrue((root / 'data/cache/seasons/matches_UZB_2_p0.json').exists())

    def test_wrong_season_response_cannot_overwrite_cached_page(self):
        def wrong(url, params):
            result = self.provider(url, params)
            if 'events' in result:
                result['events'][0]['season']['id'] = -1
            return result
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / 'data/cache/seasons/matches_UZB_2_p0.json'
            target.parent.mkdir(parents=True)
            target.write_text('{"existing":true}')
            with self.assertRaisesRegex(RuntimeError, 'Wrong competition/season'):
                self.run_sync(root, wrong)
            self.assertEqual(json.loads(target.read_text()), {'existing': True})

    def test_exact_positions_require_unambiguous_compatible_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profiles = root / 'data/cache/players'
            profiles.mkdir(parents=True)
            examples = [('D', ['DC'], 'CB'), ('D', ['LW'], None), ('M', ['MC', 'DM'], None), ('D', ['DC', 'unsupported'], None)]
            for pid, (broad, exact, _) in enumerate(examples, 1):
                (profiles / f'{pid}.json').write_text(json.dumps({'player': {'id': pid, 'position': broad, 'positionsDetailed': exact}}))
            target = root / 'data/detailed_positions.json'
            with patch.object(positions, 'ROOT', root), patch.object(positions, 'LINEUPS_DIR', root / 'lineups'), \
                    patch.object(positions, 'HEATMAPS_DIR', root / 'heatmaps'), patch.object(positions, 'OUTPUT', target), \
                    contextlib.redirect_stdout(io.StringIO()):
                positions.main()
            result = json.loads(target.read_text())
            for pid, (_, _, expected) in enumerate(examples, 1):
                self.assertEqual(result['players'][str(pid)]['detailedPosition'], expected)


if __name__ == '__main__':
    unittest.main()
