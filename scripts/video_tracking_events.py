#!/usr/bin/env python3
"""Infer conservative football events from pitch tracking CSV.

Input is the positional CSV emitted by JohnComonitski/FootballTrackingDataGeneration:
Frame,Object,Object ID,Team,X1,Y1,X1,X2,X_Pitch,Y_Pitch

The source CSV has a duplicated X1 header, so this parser intentionally reads
columns by position. This module does NOT invent shots, xG, assists, duels or
player identities. It only derives possession segments and high-level event
candidates that are directly supported by ball/player pitch coordinates.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class PlayerPoint:
    player_id: str
    team_id: int
    x_cm: float
    y_cm: float


@dataclass(frozen=True)
class BallPoint:
    x_cm: float
    y_cm: float


@dataclass(frozen=True)
class PossessionFrame:
    frame: int
    player_id: str
    team_id: int
    distance_cm: float


@dataclass
class PossessionSegment:
    player_id: str
    team_id: int
    start_frame: int
    end_frame: int
    frames: int
    avg_distance_cm: float


def _float(value: str) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _int(value: str) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def load_tracking(path: Path) -> dict[int, dict]:
    """Load player and ball positions keyed by video frame."""
    frames: dict[int, dict] = defaultdict(lambda: {"players": [], "ball": None})

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        for row in reader:
            if len(row) < 10:
                continue
            frame = _int(row[0])
            if frame is None:
                continue

            object_type = row[1].strip().lower()
            x_pitch = _float(row[8])
            y_pitch = _float(row[9])
            if x_pitch is None or y_pitch is None:
                continue

            if object_type == "ball":
                # The upstream notebook writes 0,0 when no ball is detected.
                if x_pitch == 0 and y_pitch == 0:
                    continue
                frames[frame]["ball"] = BallPoint(x_pitch, y_pitch)
                continue

            if object_type != "player":
                continue
            player_id = row[2].strip()
            team_id = _int(row[3])
            if not player_id or team_id is None:
                continue
            frames[frame]["players"].append(
                PlayerPoint(player_id, team_id, x_pitch, y_pitch)
            )

    return dict(frames)


def nearest_possession(
    frames: dict[int, dict], threshold_cm: float
) -> list[PossessionFrame]:
    """Assign a provisional owner only when a player is close enough to the ball."""
    result: list[PossessionFrame] = []
    for frame in sorted(frames):
        ball: BallPoint | None = frames[frame]["ball"]
        players: list[PlayerPoint] = frames[frame]["players"]
        if ball is None or not players:
            continue

        player, distance = min(
            (
                (p, math.hypot(p.x_cm - ball.x_cm, p.y_cm - ball.y_cm))
                for p in players
            ),
            key=lambda item: item[1],
        )
        if distance <= threshold_cm:
            result.append(
                PossessionFrame(frame, player.player_id, player.team_id, distance)
            )
    return result


def build_segments(
    ownership: Iterable[PossessionFrame],
    min_stable_frames: int,
) -> list[PossessionSegment]:
    """Collapse consecutive ownership frames into stable possession segments."""
    rows = list(ownership)
    if not rows:
        return []

    raw: list[list[PossessionFrame]] = []
    current = [rows[0]]
    for row in rows[1:]:
        prev = current[-1]
        if (
            row.frame == prev.frame + 1
            and row.player_id == prev.player_id
            and row.team_id == prev.team_id
        ):
            current.append(row)
        else:
            raw.append(current)
            current = [row]
    raw.append(current)

    segments: list[PossessionSegment] = []
    for chunk in raw:
        if len(chunk) < min_stable_frames:
            continue
        segments.append(
            PossessionSegment(
                player_id=chunk[0].player_id,
                team_id=chunk[0].team_id,
                start_frame=chunk[0].frame,
                end_frame=chunk[-1].frame,
                frames=len(chunk),
                avg_distance_cm=round(
                    sum(row.distance_cm for row in chunk) / len(chunk), 1
                ),
            )
        )
    return segments


def _confidence(
    left: PossessionSegment,
    right: PossessionSegment,
    threshold_cm: float,
    min_stable_frames: int,
) -> str:
    distance_ratio = max(left.avg_distance_cm, right.avg_distance_cm) / threshold_cm
    stable = min(left.frames, right.frames) >= min_stable_frames * 2
    if distance_ratio <= 0.5 and stable:
        return "high"
    return "medium"


def infer_events(
    segments: list[PossessionSegment],
    max_transfer_gap_frames: int,
    threshold_cm: float,
    min_stable_frames: int,
    fps: float | None,
) -> list[dict]:
    """Infer only events justified by stable possession changes.

    Same-team owner change => pass_candidate.
    Opponent owner change => possession_change.

    A possession_change is intentionally NOT labelled interception, tackle,
    duel won or failed pass because tracking coordinates alone cannot prove it.
    """
    events: list[dict] = []
    for left, right in zip(segments, segments[1:]):
        if left.player_id == right.player_id and left.team_id == right.team_id:
            continue

        gap = right.start_frame - left.end_frame - 1
        if gap < 0 or gap > max_transfer_gap_frames:
            continue

        same_team = left.team_id == right.team_id
        event_type = "pass_candidate" if same_team else "possession_change"
        frame = right.start_frame
        events.append(
            {
                "type": event_type,
                "frame": frame,
                "time_seconds": round(frame / fps, 3) if fps else None,
                "team_id": left.team_id if same_team else None,
                "from_player_id": left.player_id,
                "from_team_id": left.team_id,
                "to_player_id": right.player_id,
                "to_team_id": right.team_id,
                "gap_frames": gap,
                "confidence": _confidence(
                    left, right, threshold_cm, min_stable_frames
                ),
                "evidence": {
                    "from_end_frame": left.end_frame,
                    "to_start_frame": right.start_frame,
                    "from_avg_ball_distance_cm": left.avg_distance_cm,
                    "to_avg_ball_distance_cm": right.avg_distance_cm,
                },
            }
        )
    return events


def build_summary(events: list[dict], segments: list[PossessionSegment]) -> dict:
    player_stats: dict[str, dict] = {}
    team_stats: dict[str, dict] = defaultdict(
        lambda: {"pass_candidates": 0, "possession_changes_out": 0}
    )

    for segment in segments:
        key = f"{segment.team_id}:{segment.player_id}"
        if key not in player_stats:
            player_stats[key] = {
                "player_id": segment.player_id,
                "team_id": segment.team_id,
                "stable_possessions": 0,
                "pass_candidates_completed": 0,
                "pass_candidates_received": 0,
            }
        player_stats[key]["stable_possessions"] += 1

    for event in events:
        from_key = f"{event['from_team_id']}:{event['from_player_id']}"
        to_key = f"{event['to_team_id']}:{event['to_player_id']}"

        if event["type"] == "pass_candidate":
            team_stats[str(event["from_team_id"])]["pass_candidates"] += 1
            player_stats[from_key]["pass_candidates_completed"] += 1
            player_stats[to_key]["pass_candidates_received"] += 1
        else:
            team_stats[str(event["from_team_id"])]["possession_changes_out"] += 1

    return {
        "teams": dict(team_stats),
        "players": sorted(
            player_stats.values(),
            key=lambda row: (row["team_id"], str(row["player_id"])),
        ),
    }


def analyse(
    input_path: Path,
    threshold_cm: float,
    min_stable_frames: int,
    max_transfer_gap_frames: int,
    fps: float | None,
) -> dict:
    frames = load_tracking(input_path)
    ownership = nearest_possession(frames, threshold_cm)
    segments = build_segments(ownership, min_stable_frames)
    events = infer_events(
        segments,
        max_transfer_gap_frames,
        threshold_cm,
        min_stable_frames,
        fps,
    )
    return {
        "schema_version": 1,
        "method": "tracking-events-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(input_path),
        "coordinate_system": {
            "unit": "cm",
            "reference_pitch": "Roboflow Sports SoccerPitchConfiguration",
            "length_cm": 12000,
            "width_cm": 7000,
        },
        "parameters": {
            "possession_threshold_cm": threshold_cm,
            "min_stable_frames": min_stable_frames,
            "max_transfer_gap_frames": max_transfer_gap_frames,
            "fps": fps,
        },
        "coverage": {
            "frames_with_tracking": len(frames),
            "ownership_frames": len(ownership),
            "stable_possession_segments": len(segments),
            "event_candidates": len(events),
        },
        "limitations": [
            "pass_candidate means stable same-team possession changed between two tracked players; it is not yet manually verified",
            "possession_change is not classified as tackle, interception, duel or failed pass",
            "shots, xG, assists and key passes are not inferred in v1",
            "tracker IDs are not automatically mapped to real player identities",
        ],
        "segments": [asdict(segment) for segment in segments],
        "events": events,
        "summary": build_summary(events, segments),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Infer conservative event candidates from football tracking CSV."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--fps", type=float, default=None)
    parser.add_argument("--possession-threshold-cm", type=float, default=180.0)
    parser.add_argument("--min-stable-frames", type=int, default=4)
    parser.add_argument("--max-transfer-gap-frames", type=int, default=50)
    args = parser.parse_args()

    if args.possession_threshold_cm <= 0:
        parser.error("--possession-threshold-cm must be > 0")
    if args.min_stable_frames <= 0:
        parser.error("--min-stable-frames must be > 0")
    if args.max_transfer_gap_frames < 0:
        parser.error("--max-transfer-gap-frames must be >= 0")
    if args.fps is not None and args.fps <= 0:
        parser.error("--fps must be > 0")

    payload = analyse(
        args.input,
        args.possession_threshold_cm,
        args.min_stable_frames,
        args.max_transfer_gap_frames,
        args.fps,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"Wrote {len(payload['events'])} event candidates "
        f"from {payload['coverage']['stable_possession_segments']} stable possessions "
        f"to {args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
