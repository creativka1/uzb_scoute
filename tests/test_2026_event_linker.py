import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "link_2026_lineups.py"
spec = importlib.util.spec_from_file_location("event_linker", SCRIPT)
event_linker = importlib.util.module_from_spec(spec)
sys.modules["event_linker"] = event_linker
spec.loader.exec_module(event_linker)


class EventLinkerTests(unittest.TestCase):
    def test_dominant_team_tolerates_transferred_players(self):
        side = {"players": [{"teamId": 10}] * 16 + [{"teamId": 99}] * 3}
        team_id, count, total = event_linker.dominant_team_id(side)
        self.assertEqual(team_id, 10)
        self.assertEqual((count, total), (16, 19))

    def test_strong_plurality_handles_transfer_noise(self):
        side = {"players": (
            [{"teamId": 10}] * 11 +
            [{"teamId": 99}] * 4 +
            [{"teamId": 77}] * 3 +
            [{"teamId": 66}] * 2
        )}
        team_id, count, total = event_linker.dominant_team_id(side)
        self.assertEqual(team_id, 10)
        self.assertEqual((count, total), (11, 20))

    def test_close_plurality_is_not_accepted(self):
        side = {"players": [{"teamId": 10}] * 10 + [{"teamId": 99}] * 6 + [{"teamId": 77}] * 4}
        team_id, count, total = event_linker.dominant_team_id(side)
        self.assertIsNone(team_id)
        self.assertEqual((count, total), (10, 20))

    def test_inferred_score_includes_opponent_own_goal(self):
        lineup = {
            "home": {"players": [
                {"statistics": {"goals": 1}},
                {"statistics": {"goals": 1}},
            ]},
            "away": {"players": [
                {"statistics": {"goals": 1}},
                {"statistics": {"ownGoals": 1}},
            ]},
        }
        self.assertEqual(event_linker.inferred_score(lineup), (3, 1))

    def test_exact_pair_and_score_yields_one_match(self):
        mapping = {"UZB": {10: "Nasaf", 20: "Pakhtakor"}, "KAZ": {}}
        record = {
            "eventId": 1, "league": "UZB",
            "homeSofaTeamId": 10, "awaySofaTeamId": 20,
            "score": [2, 1],
        }
        official = {
            "UZB": [
                {"id": 100, "homeName": "Nasaf", "awayName": "Pakhtakor",
                 "homeScore": 2, "awayScore": 1},
                {"id": 101, "homeName": "Nasaf", "awayName": "Bunyodkor",
                 "homeScore": 2, "awayScore": 1},
            ]
        }
        rows = event_linker.candidate_matches(record, official, mapping)
        self.assertEqual([row["id"] for row in rows], [100])

    def test_exact_pair_survives_player_goal_mismatch(self):
        mapping = {"UZB": {10: "Nasaf", 20: "Pakhtakor"}, "KAZ": {}}
        record = {
            "eventId": 1, "league": "UZB",
            "homeSofaTeamId": 10, "awaySofaTeamId": 20,
            "score": [0, 0],
            "homeDominance": [18, 20], "awayDominance": [18, 20],
        }
        official = {
            "UZB": [
                {"id": 100, "homeName": "Nasaf", "awayName": "Pakhtakor",
                 "homeScore": 2, "awayScore": 1, "seasonId": 1, "date": 1,
                 "homeTeamId": 1, "awayTeamId": 2},
            ],
            "KAZ": [],
        }
        links, ambiguous, unmatched = event_linker.link_events([record], official, mapping)
        self.assertEqual(len(links), 1)
        self.assertTrue(links[0]["scoreMismatch"])
        self.assertEqual(ambiguous, [])
        self.assertEqual(unmatched, [])

    def test_ambiguous_match_is_not_forced(self):
        mapping = {"UZB": {10: "Nasaf", 20: "Pakhtakor"}, "KAZ": {}}
        record = {
            "eventId": 1, "league": "UZB",
            "homeSofaTeamId": 10, "awaySofaTeamId": 20,
            "score": [1, 1],
            "homeDominance": [16, 18], "awayDominance": [17, 19],
        }
        official = {
            "UZB": [
                {"id": 100, "homeName": "Nasaf", "awayName": "Pakhtakor",
                 "homeScore": 1, "awayScore": 1, "seasonId": 1, "date": 1,
                 "homeTeamId": 1, "awayTeamId": 2},
                {"id": 101, "homeName": "Nasaf", "awayName": "Pakhtakor",
                 "homeScore": 1, "awayScore": 1, "seasonId": 1, "date": 2,
                 "homeTeamId": 1, "awayTeamId": 2},
            ],
            "KAZ": [],
        }
        links, ambiguous, unmatched = event_linker.link_events([record], official, mapping)
        self.assertEqual(links, [])
        self.assertEqual(len(ambiguous), 1)
        self.assertEqual(unmatched, [])


if __name__ == "__main__":
    unittest.main()
