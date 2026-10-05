# FootyStats in Uzstat

The connector is active code, with a dedicated GitHub Actions job and a source-status API. Authentication is server-side only. A successful test with mock responses is not evidence of a live paid account connection: the committed status records the actual last sync outcome.

## Activate and verify

1. Add `FOOTYSTATS_API_KEY` in repository Settings → Secrets and variables → Actions. Never put it in `NEXT_PUBLIC_*` or in a committed file.
2. Run Actions → **Sync FootyStats**. New connector commits also trigger this job on `main` and the implementation branch.
3. Check `data/audits/footystats_status.json`. `connected` requires real records from the requested league/season; `not_configured`, `season_unavailable`, `empty` and `error` are distinct outcomes.
4. In the app, open **FootyStats** below the scope selector. In a player profile the same panel shows independently sourced season statistics after identity reconciliation.

Local sync: `FOOTYSTATS_API_KEY=… node scripts/sync_footystats.mjs`. Optional `FOOTYSTATS_YEAR` defaults to 2026. The normal statistics workflow also invokes this sync after rebuilding its primary evidence.

## Data and identity policy

- `league-list` discovers exact country, competition and year. FootyStats season IDs are independent of SofaScore IDs. If discovery is ambiguous or the season is unavailable, no other year is substituted. Reviewed overrides can be added in `data/footystats/config.json` under a league's `seasonIds`.
- `league-players?include=stats` is paginated beyond 200 players. Competition IDs are checked before saving a snapshot.
- `data/footystats/UZB-2026.json` and `KAZ-2026.json` contain normalized provider observations. Missing values and negative provider sentinels become null; a real zero remains zero.
- Identity linking requires a unique exact full name and date of birth, or a reviewed `playerLinks` crosswalk (`"UZB:<FootyStats player ID>": <SofaScore player ID>`). IDs from the two providers are never assumed equivalent. Unmatched players stay unlinked.
- FootyStats is shown separately from loaded-match observations. No FootyStats season totals, player/team statistics or provider percentiles are silently inserted into the main radar, Fit ranking or match history.
- Incomplete syncs retain previous successful snapshots but visibly mark them as saved copies whose refresh is unconfirmed.
- `/api/sources?league=UZB&year=2026&playerId=123` exposes status and a reconciled player. It exposes neither credentials nor arbitrary local paths.

Official API contracts: [League list](https://footystats.org/api/documentations/league-list), [League players](https://footystats.org/api/documentations/league-players), [Individual player fields](https://footystats.org/api/documentations/player-individual).
