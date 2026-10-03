"""Synthetic unit fixtures only; none are written to the football dataset."""
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from data_integrity import aggregate, profile_fields, number, ratio


def appearance(event, stats):
    return {'eventId': event, 'date': 100 + event, 'statistics': {'minutesPlayed': 90, **stats}}


class DataIntegrityTests(unittest.TestCase):
    def test_missing_is_not_zero(self):
        stats = aggregate([appearance(1, {'goals': 0}), appearance(2, {})])
        self.assertIsNone(stats['goals'])
        self.assertEqual(stats['observedTotals']['goals'], 0)
        self.assertEqual(stats['metricCoverage']['goals'], 1)
        self.assertIsNone(stats['assists'])
        self.assertIsNone(aggregate([]))

    def test_interception_mapping_and_partial_preservation(self):
        stats = aggregate([appearance(1, {'interceptionWon': 3}), appearance(2, {})])
        self.assertIsNone(stats['interceptions'])
        self.assertEqual(stats['observedTotals']['interceptions'], 3)
        complete = aggregate([appearance(1, {'interceptionWon': 3}), appearance(2, {'interceptionWon': 0})])
        self.assertEqual(complete['interceptions'], 3)

    def test_zero_and_xg_are_preserved(self):
        stats = aggregate([appearance(1, {'goals': 0, 'expectedGoals': 0.12, 'expectedAssists': 0})])
        self.assertEqual(stats['goals'], 0)
        self.assertEqual(stats['xG'], 0.12)
        self.assertEqual(stats['xA'], 0)

    def test_ratios_require_complete_numerators_and_denominators(self):
        stats = aggregate([appearance(1, {'totalPass': 10, 'accuratePass': 8}), appearance(2, {'totalPass': 20})])
        self.assertIsNone(stats['passAccPct'])
        self.assertIsNone(ratio(None, 10))
        self.assertIsNone(ratio(0, 0))
        self.assertIsNone(ratio(11, 10))
        self.assertEqual(ratio(0, 10), 0)

    def test_no_profile_defaults(self):
        profile = profile_fields({})
        for key in ['position', 'dateOfBirthTimestamp', 'jerseyNumber', 'height', 'preferredFoot', 'marketValueCurrency', 'contractUntil', 'countryCode']:
            self.assertIsNone(profile[key], key)
        self.assertIsNone(profile_fields({'proposedMarketValueRaw': {'value': 12, 'currency': 'USD'}})['marketValueCurrency'])
        self.assertEqual(profile_fields({'jerseyNumber': '0'})['jerseyNumber'], 0)

    def test_bad_numbers_rejected(self):
        for value in [True, False, '10', float('nan'), float('inf'), -1]:
            self.assertIsNone(number(value))

    def test_committed_data_is_verified_and_has_no_fake_clubs(self):
        root = Path(__file__).resolve().parents[1]
        players = json.loads((root / 'data/superliga_stats.json').read_text())
        self.assertEqual(len(players), len({(p['league'], p['sofaId']) for p in players}))
        for player in players:
            self.assertEqual(player['schemaVersion'], 2)
            self.assertNotEqual(player['club'], 'Club')
            if player['countryCode'] is None:
                self.assertIsNone(player['isLegionnaire'])
            for key in ['currentSeason', 'previousSeason', 'twoSeasons']:
                stats = player[key]
                if stats is None:
                    continue
                self.assertEqual(stats['matchesPlayed'], len(set(stats['eventIds'])))
                for metric, known in stats['metricCoverage'].items():
                    if known < stats['matchesPlayed']:
                        self.assertIsNone(stats[metric], (player['sofaId'], key, metric))

class MatchObservationTests(unittest.TestCase):
    def test_partial_rate_uses_only_observed_minutes(self):
        d=aggregate([appearance(1,{'minutesPlayed':30,'goalAssist':1}),appearance(2,{})])['metricDetails']['assists']
        self.assertEqual(d['value'],1)
        self.assertEqual(d['per90'],3)
        self.assertEqual(d['eventIds'],[1])
        self.assertEqual(d['status'],'partial')

    def test_ratios_cannot_mix_matches(self):
        stats=aggregate([appearance(1,{'accuratePass':8,'totalPass':10}),appearance(2,{'totalPass':100}),appearance(3,{'accuratePass':80})])
        d=stats['metricDetails']['passAccPct']
        self.assertEqual(d['value'],80)
        self.assertEqual(d['eventIds'],[1])
        self.assertIsNone(aggregate([appearance(1,{'totalContest':0,'wonContest':0})])['metricDetails']['dribbleSuccessRate']['value'])

    def test_core_provenance_matches_original_payloads(self):
        import gzip,hashlib
        from data_integrity import METRICS
        root=Path(__file__).resolve().parents[1]
        core=json.loads(gzip.decompress((root/'data/match_core.json.gz').read_bytes()))
        matches={m['id']:m for m in core['matches']}
        self.assertEqual(len(core['appearances']),len({a['id'] for a in core['appearances']}))
        payloads={}
        for a in core['appearances']:
            m=matches[a['matchId']]
            self.assertIn(a['teamId'],[m['homeTeamId'],m['awayTeamId']])
            self.assertTrue(m['lineupAvailable'])
            if m['id'] not in payloads:
                raw=(root/m['sourcePath']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(),m['lineupHash'])
                payloads[m['id']]=json.loads(raw)
            side='home' if a['teamId']==m['homeTeamId'] else 'away'
            original=next(p for p in payloads[m['id']][side]['players'] if p['player']['id']==a['playerId'])
            for key,src in METRICS.items():
                self.assertEqual(a['stats'][key],number(original.get('statistics',{}).get(src)))

if __name__ == '__main__':
    unittest.main()
