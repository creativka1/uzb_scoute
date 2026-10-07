# Video analysis V1

This is the first conservative bridge from football computer vision tracking into Uzstat.

## What it does

The current V1 accepts the tracking CSV produced by
[JohnComonitski/FootballTrackingDataGeneration](https://github.com/JohnComonitski/FootballTrackingDataGeneration)
and derives only events that are directly supported by player/ball pitch coordinates:

- stable possession segments;
- `pass_candidate` when stable possession moves from one tracked player to another player on the same team;
- `possession_change` when the next stable owner belongs to the opponent;
- per-player and per-team candidate counts;
- evidence and confidence for every event candidate.

The upstream Roboflow Sports pitch coordinate system is 12000 × 7000 cm.

## What it deliberately does NOT claim yet

V1 does **not** infer or fabricate:

- shots;
- xG;
- assists;
- key passes;
- tackles;
- interceptions;
- duel outcomes;
- real player names from tracker IDs.

A possession change can be caused by several football actions, so V1 keeps the neutral
`possession_change` label until there is additional video/event evidence.

## Run it

First produce a tracking CSV with the external tracking repository. Then run:

```bash
python scripts/video_tracking_events.py \
  --input /path/to/match.csv \
  --out data/video/match.events.json \
  --fps 25
```

Optional tuning:

```bash
python scripts/video_tracking_events.py \
  --input /path/to/match.csv \
  --out data/video/match.events.json \
  --fps 25 \
  --possession-threshold-cm 180 \
  --min-stable-frames 4 \
  --max-transfer-gap-frames 50
```

The defaults are starting points, not validated universal football constants. They must be
calibrated on real Uzbekistan match footage before these candidate counts are used as club
statistics.

## Output

The JSON contains:

- input coverage;
- parameters;
- stable possession segments;
- event candidates with frame/time/confidence/evidence;
- conservative player/team summaries;
- explicit limitations.

## Next milestones

1. Test tracking + V1 events on short real Uzbekistan match clips.
2. Add a review UI so a human can accept/reject candidate events.
3. Map tracker IDs to lineups/player IDs.
4. Add ball-trajectory logic for `shot_candidate`.
5. Add richer event classification only after validation.
6. Feed verified event data into match/player analytics and recruitment metrics.

The product rule remains: missing or uncertain football data stays missing/uncertain instead
of being silently converted into a confident statistic.
