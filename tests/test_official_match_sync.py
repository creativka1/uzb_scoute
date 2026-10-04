import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "sync_official_2026_matches.py"
spec = importlib.util.spec_from_file_location("official_sync", SCRIPT)
official_sync = importlib.util.module_from_spec(spec)
sys.modules["official_sync"] = official_sync
spec.loader.exec_module(official_sync)


class OfficialMatchParserTests(unittest.TestCase):
    def test_pfl_finished_match(self):
        html = """
        <html><body>
          <div>Superleague MW1</div>
          <div>Kick-off time 27.02.2026, 13:00</div>
          <a>Bukhara FA</a><div>Referee:</div><a>Shavkat Nasibullaev</a>
          <a>Bukhoro</a><h1>1-0</h1><div>Finished</div><a>Qo'qon-1912</a>
        </body></html>
        """
        row = official_sync.parse_pfl(html, 3803)
        self.assertIsNotNone(row)
        self.assertEqual(row["round"], 1)
        self.assertEqual(row["home"], "Bukhoro")
        self.assertEqual(row["away"], "Qo'qon-1912")
        self.assertEqual((row["homeScore"], row["awayScore"]), (1, 0))
        self.assertTrue(row["finished"])

    def test_pfl_upcoming_score_placeholder_is_not_result(self):
        html = """
        <html><body>
          <div>Superleague MW30</div>
          <div>Kick-off time 01.12.2026, 19:00</div>
          <a>Mashal</a><h1>0-0</h1><a>Neftchi</a>
        </body></html>
        """
        row = official_sync.parse_pfl(html, 4050)
        self.assertEqual(row["home"], "Mashal")
        self.assertEqual(row["away"], "Neftchi")
        self.assertIsNone(row["homeScore"])
        self.assertIsNone(row["awayScore"])
        self.assertFalse(row["finished"])

    def test_kff_finished_match(self):
        html = """
        <html><body>
          <div>Премьер-Лига 2026, 1 тур</div>
          <div>сб, 7 мар. 2026 г.</div>
          <div>16:00</div>
          <a>Алтай</a><div>0:1</div><a>Кайрат</a>
          <div>Обзор Статистика Состав</div>
        </body></html>
        """
        row = official_sync.parse_kff(html, 885)
        self.assertIsNotNone(row)
        self.assertEqual(row["round"], 1)
        self.assertEqual(row["home"], "Алтай")
        self.assertEqual(row["away"], "Кайрат")
        self.assertEqual((row["homeScore"], row["awayScore"]), (0, 1))
        self.assertTrue(row["finished"])

    def test_kff_completed_match_from_seo_title_with_full_month(self):
        html = """
        <html>
          <head><title>Астана 3:2 Актобе — КПЛ, 12 июля 2026 г. | Казахстанская Премьер-Лига</title></head>
          <body>
            <div>Премьер-Лига 2026, 17 тур</div>
            <div>вс, 12 июл. 2026 г.</div>
            <div>19:00</div>
            <div>Астана</div><div>3:2</div><div>Актобе</div>
          </body>
        </html>
        """
        row = official_sync.parse_kff(html, 1013)
        self.assertIsNotNone(row)
        self.assertEqual(row["round"], 17)
        self.assertEqual(row["home"], "Астана")
        self.assertEqual(row["away"], "Актобе")
        self.assertEqual((row["homeScore"], row["awayScore"]), (3, 2))
        self.assertTrue(row["finished"])

    def test_pfl_technical_defeat_is_not_a_team_or_score(self):
        html = """
        <html><body>
          <div>Superleague MW15</div>
          <div>Kick-off time 31.07.2026, 19:00</div>
          <a>Yoshlar SC</a><a>Qizilqum</a><h1>0-0</h1>
          <div>Finished</div><div>Technical defeat</div><a>Bunyodkor</a>
        </body></html>
        """
        row = official_sync.parse_pfl(html, 3853)
        self.assertIsNotNone(row)
        self.assertEqual(row["home"], "Qizilqum")
        self.assertEqual(row["away"], "Bunyodkor")
        self.assertIsNone(row["homeScore"])
        self.assertIsNone(row["awayScore"])
        self.assertTrue(row["finished"])

    def test_kff_unconfirmed_time_is_skipped(self):
        html = """
        <html><body>
          <div>Премьер-Лига 2026, 30 тур</div>
          <div>сб, 31 окт. 2026 г.</div>
          <div>Предстоящий</div>
          <a>Жетысу</a><div>- : -</div><a>Астана</a>
        </body></html>
        """
        self.assertIsNone(official_sync.parse_kff(html, 1124))

    def test_script_payload_is_not_visible_text(self):
        html = """
        <html><body>
          <script>self.__next_f.push([1,"garbage team name"])</script>
          <style>.hidden{display:none}</style>
          <div>Премьер-Лига 2026, 1 тур</div>
          <div>сб, 7 мар. 2026 г.</div>
          <div>16:00</div>
          <a>Алтай</a><div>0:1</div><a>Кайрат</a>
        </body></html>
        """
        parts = official_sync.text_parts(html)
        self.assertFalse(any("self.__next_f.push" in value for value in parts))
        row = official_sync.parse_kff(html, 885)
        self.assertEqual(row["home"], "Алтай")
        self.assertEqual(row["away"], "Кайрат")

    def test_team_ids_are_stable_and_league_scoped(self):
        uz = official_sync.stable_team_id("UZB", "Nasaf")
        kz = official_sync.stable_team_id("KAZ", "Nasaf")
        self.assertEqual(uz, official_sync.stable_team_id("UZB", "  nasaf  "))
        self.assertNotEqual(uz, kz)


if __name__ == "__main__":
    unittest.main()
