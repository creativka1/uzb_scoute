import csv
import importlib.util
import tempfile
import unittest
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "video_tracking_events.py"
SPEC = importlib.util.spec_from_file_location("video_tracking_events", MODULE_PATH)
video = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = video
SPEC.loader.exec_module(video)


class VideoTrackingEventsTest(unittest.TestCase):
    def write_fixture(self, path: Path):
        rows = [["Frame","Object","Object ID","Team","X1","Y1","X1","X2","X_Pitch","Y_Pitch"]]

        for frame in range(1, 7):
            rows.append([frame,"player","10","0",0,0,0,0,1000,1000])
            rows.append([frame,"player","11","0",0,0,0,0,3000,1000])
            rows.append([frame,"player","20","1",0,0,0,0,6000,1000])
            rows.append([frame,"ball","","",0,0,0,0,1050,1000])

        for frame in range(7, 11):
            rows.append([frame,"player","10","0",0,0,0,0,1000,1000])
            rows.append([frame,"player","11","0",0,0,0,0,3000,1000])
            rows.append([frame,"player","20","1",0,0,0,0,6000,1000])
            rows.append([frame,"ball","","",0,0,0,0,2000,1000])

        for frame in range(11, 17):
            rows.append([frame,"player","10","0",0,0,0,0,1000,1000])
            rows.append([frame,"player","11","0",0,0,0,0,3000,1000])
            rows.append([frame,"player","20","1",0,0,0,0,6000,1000])
            rows.append([frame,"ball","","",0,0,0,0,3050,1000])

        for frame in range(17, 21):
            rows.append([frame,"player","11","0",0,0,0,0,3000,1000])
            rows.append([frame,"player","20","1",0,0,0,0,6000,1000])
            rows.append([frame,"ball","","",0,0,0,0,4500,1000])

        for frame in range(21, 27):
            rows.append([frame,"player","11","0",0,0,0,0,3000,1000])
            rows.append([frame,"player","20","1",0,0,0,0,6000,1000])
            rows.append([frame,"ball","","",0,0,0,0,6050,1000])

        with path.open("w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows(rows)

    def test_same_team_change_is_pass_candidate_and_opponent_change_is_not_failed_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "tracking.csv"
            self.write_fixture(source)
            payload = video.analyse(
                source,
                threshold_cm=180,
                min_stable_frames=4,
                max_transfer_gap_frames=10,
                fps=25,
            )

        self.assertEqual([e["type"] for e in payload["events"]], [
            "pass_candidate",
            "possession_change",
        ])
        first = payload["events"][0]
        self.assertEqual(first["from_player_id"], "10")
        self.assertEqual(first["to_player_id"], "11")
        self.assertEqual(first["team_id"], 0)
        self.assertEqual(payload["summary"]["teams"]["0"]["pass_candidates"], 1)
        self.assertEqual(payload["summary"]["players"][0]["pass_candidates_completed"], 1)

    def test_missing_ball_zero_coordinates_are_ignored(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "tracking.csv"
            with source.open("w", newline="", encoding="utf-8") as handle:
                csv.writer(handle).writerows([
                    ["Frame","Object","Object ID","Team","X1","Y1","X1","X2","X_Pitch","Y_Pitch"],
                    [1,"player","10","0",0,0,0,0,1000,1000],
                    [1,"ball","","",0,0,0,0,0,0],
                ])
            frames = video.load_tracking(source)
        self.assertIsNone(frames[1]["ball"])


if __name__ == "__main__":
    unittest.main()
