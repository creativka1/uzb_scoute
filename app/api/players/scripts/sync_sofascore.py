import json
import os
import time
import random
from datetime import datetime
from curl_cffi import requests

# Конфигурация шлюза RapidAPI
RAPIDAPI_HOST = "sofascore.p.rapidapi.com"
RAPIDAPI_KEY = "d859b78cadmshfbf9a5b1d1a25bdp1b5d9ajsnab0015b3dc1f"

# Выбираем лигу для текущей загрузки (сейчас KAZ, потом можно сменить на UZB)
TARGET_TOURNAMENTS = [
    {
        "league": "KAZ",
        "name": "Kazakhstan Premier League",
        "id": 682
    }
]

CACHE_DIR = os.path.join("data", "cache")
CACHE_LINEUPS = os.path.join(CACHE_DIR, "lineups")
CACHE_SEASONS = os.path.join(CACHE_DIR, "seasons")

for p in [CACHE_LINEUPS, CACHE_SEASONS]:
    os.makedirs(p, exist_ok=True)

RAPIDAPI_HEADERS = {
    "X-RapidAPI-Key": RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
    "Accept": "application/json",
}

def empty_stat_bucket():
    return {
        "matchesPlayed": 0, "minutesPlayed": 0, "goals": 0, "assists": 0,
        "totalPass": 0, "accuratePass": 0, "duelWon": 0, "duelLost": 0,
        "aerialWon": 0, "aerialLost": 0, "dribbleWon": 0, "dribbleTotal": 0,
        "tackles": 0, "interceptions": 0, "keyPasses": 0, "saves": 0,
        "shots": 0, "shotsOnTarget": 0, "bigChanceCreated": 0, "bigChanceMissed": 0,
    }

def get_cached_json(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None

def save_cached_json(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass

def format_contract_date(timestamp):
    if not timestamp:
        return "—"
    try:
        return datetime.fromtimestamp(int(timestamp)).strftime("%d/%m/%Y")
    except Exception:
        return "—"


def fetch_player_profile(session, player_id):
    """Получает актуальный профиль игрока: клуб, стоимость, контракт и гражданство."""
    cache_file = os.path.join(CACHE_DIR, "players", f"{player_id}.json")
    os.makedirs(os.path.dirname(cache_file), exist_ok=True)

    cached = get_cached_json(cache_file)
    if cached:
        cached_at = cached.get("_cachedAt", 0)
        if time.time() - cached_at < 24 * 3600:
            return cached.get("player", {})

    try:
        url = f"https://www.sofascore.com/api/v1/player/{player_id}"
        response = session.get(url, timeout=10)
        if response.status_code == 200:
            payload = response.json()
            player = payload.get("player", {})
            save_cached_json(cache_file, {"_cachedAt": time.time(), "player": player})
            return player
    except Exception:
        pass

    return cached.get("player", {}) if cached else {}


def refresh_current_profiles(session, players):
    """Обновляет изменившиеся клубы, стоимость, контракт и страну."""
    for idx, p in enumerate(players):
        profile = fetch_player_profile(session, p["sofaId"])
        if not profile:
            continue

        team = profile.get("team") or {}
        if team.get("name"):
            p["club"] = team["name"]

        market_raw = (profile.get("proposedMarketValueRaw") or {}).get("value")
        if market_raw is None:
            market_raw = profile.get("marketValue")
        if market_raw:
            p["marketValueCurrency"] = market_raw

        contract_ts = profile.get("contractUntilTimestamp")
        if contract_ts:
            p["contractUntil"] = format_contract_date(contract_ts)

        country = profile.get("country") or {}
        if country.get("alpha2"):
            p["countryCode"] = country["alpha2"].upper()

        p["preferredFoot"] = profile.get("preferredFoot") or p.get("preferredFoot", "Right")
        p["height"] = profile.get("height") or p.get("height", 182)
        p["jerseyNumber"] = profile.get("jerseyNumber") or p.get("jerseyNumber", 10)

        if idx % 10 == 0:
            time.sleep(0.05)


def fetch_json(session, url, params=None, retries=2):
    for attempt in range(retries):
        try:
            r = session.get(url, headers=RAPIDAPI_HEADERS, params=params, timeout=10)
            if r.status_code == 200:
                return r.json()
            elif r.status_code in (429, 403):
                time.sleep(2.0 + attempt * 1.5)
            else:
                time.sleep(0.3)
        except Exception:
            time.sleep(0.5)
    return None

def sync_targeted_league():
    session = requests.Session(impersonate="chrome120")
    all_players_master = {}

    for tourney in TARGET_TOURNAMENTS:
        t_id = tourney["id"]
        league_code = tourney["league"]
        print(f"\n==========================================")
        print(f"[{league_code}] Загрузка: {tourney['name']} (ID: {t_id})")
        print(f"==========================================")

        seasons_cache_file = os.path.join(CACHE_SEASONS, f"{league_code}_{t_id}_seasons.json")
        seasons_data = get_cached_json(seasons_cache_file)

        if not seasons_data:
            url = f"https://{RAPIDAPI_HOST}/tournaments/get-seasons"
            seasons_data = fetch_json(session, url, params={"tournamentId": t_id})
            if seasons_data and seasons_data.get("seasons"):
                save_cached_json(seasons_cache_file, seasons_data)
            else:
                print(f"-> Не удалось загрузить сезоны для {league_code}. Пропуск.")
                continue

        seasons = seasons_data.get("seasons", [])[:2]
        print(f"-> Найдено сезонов: {len(seasons)}")

        for s_idx, s in enumerate(seasons):
            s_id = s["id"]
            s_name = s.get("name", f"Season {s_idx+1}")
            is_current = (s_idx == 0)
            print(f"  -> Сезон: {s_name} (ID: {s_id})...")

            page_index = 0
            seen_events = set()

            while page_index < 3:
                page_cache_file = os.path.join(CACHE_SEASONS, f"matches_{league_code}_{s_id}_p{page_index}.json")
                res_data = get_cached_json(page_cache_file)

                if not res_data:
                    matches_url = f"https://{RAPIDAPI_HOST}/tournaments/get-matches"
                    res_data = fetch_json(session, matches_url, params={"tournamentId": t_id, "seasonId": s_id, "pageIndex": page_index})
                    if res_data and (res_data.get("events") or res_data.get("matches")):
                        if not is_current:
                            save_cached_json(page_cache_file, res_data)
                    else:
                        break

                events = res_data.get("events", res_data.get("matches", [])) if res_data else []
                if not events:
                    break

                finished = [e for e in events if e.get("status", {}).get("type") == "finished" and e["id"] not in seen_events]
                print(f"    Завершенных матчей на странице {page_index}: {len(finished)}")
                if not finished and page_index > 0:
                    break

                for m in finished:
                    seen_events.add(m["id"])
                    m_id = m["id"]

                    lineup_file = os.path.join(CACHE_LINEUPS, f"{m_id}.json")
                    lj = get_cached_json(lineup_file)

                    if not lj:
                        lineup_url = f"https://{RAPIDAPI_HOST}/matches/get-lineups"
                        lj = fetch_json(session, lineup_url, params={"matchId": m_id})
                        if lj:
                            save_cached_json(lineup_file, lj)
                            time.sleep(random.uniform(0.02, 0.05))
                        else:
                            continue

                    for side in ["home", "away"]:
                        team_name = lj.get(side, {}).get("team", {}).get("name", "Club")
                        for item in lj.get(side, {}).get("players", []):
                            p = item.get("player", {})
                            p_id = p.get("id")
                            stats = item.get("statistics", {})
                            mins = stats.get("minutesPlayed", 0)
                            if not p_id or mins == 0:
                                continue

                            if p_id not in all_players_master:
                                dob = p.get("dateOfBirthTimestamp")
                                age = 23
                                if dob:
                                    age = int((time.time() - dob) / (365.25 * 86400))

                                pos_letter = item.get("position", p.get("position", "M"))
                                gen_pos = "GK" if pos_letter == "G" else "DF" if pos_letter == "D" else "FW" if pos_letter == "F" else "MF"

                                all_players_master[p_id] = {
                                    "sofaId": p_id,
                                    "league": league_code,
                                    "name": p.get("name"),
                                    "shortName": p.get("shortName", p.get("name")),
                                    "club": team_name,
                                    "position": gen_pos,
                                    "age": age,
                                    "jerseyNumber": item.get("jerseyNumber", p.get("jerseyNumber", 10)),
                                    "height": p.get("height", 182),
                                    "preferredFoot": p.get("preferredFoot", "Right"),
                                    "marketValueCurrency": p.get("proposedMarketValueRaw", {}).get("value", 150000),
                                    "current": empty_stat_bucket(),
                                    "total": empty_stat_bucket(),
                                }

                            target_buckets = [all_players_master[p_id]["total"]]
                            if is_current:
                                target_buckets.append(all_players_master[p_id]["current"])

                            for b in target_buckets:
                                b["matchesPlayed"] += 1
                                b["minutesPlayed"] += mins
                                b["goals"] += stats.get("goals", 0)
                                b["assists"] += stats.get("goalAssist", 0)
                                b["totalPass"] += stats.get("totalPass", 0)
                                b["accuratePass"] += stats.get("accuratePass", 0)
                                b["duelWon"] += stats.get("duelWon", 0)
                                b["duelLost"] += stats.get("duelLost", 0)
                                b["aerialWon"] += stats.get("aerialWon", 0)
                                b["aerialLost"] += stats.get("aerialLost", 0)
                                b["dribbleWon"] += stats.get("wonContest", 0)
                                b["dribbleTotal"] += stats.get("totalContest", stats.get("wonContest", 0))
                                b["tackles"] += stats.get("totalTackle", 0)
                                b["interceptions"] += stats.get("interception", 0)
                                b["keyPasses"] += stats.get("keyPass", 0)
                                b["saves"] += stats.get("saves", 0)
                                b["shots"] += stats.get("totalShots", stats.get("shotOffTarget", 0) + stats.get("onTargetScoringAttempt", 0))
                                b["shotsOnTarget"] += stats.get("onTargetScoringAttempt", 0)
                                b["bigChanceCreated"] += stats.get("bigChanceCreated", 0)
                                b["bigChanceMissed"] += stats.get("bigChanceMissed", 0)

                page_index += 1

    if not all_players_master:
        print("\n[ВНИМАНИЕ] Новые данные не получены.")
        return

    players_list = list(all_players_master.values())
    print(f"\n[ИНФО] Обработка {len(players_list)} игроков для лиги {TARGET_TOURNAMENTS[0]['league']}...")
    print("[ИНФО] Обновление актуальных профилей игроков (клуб, стоимость, контракт)...")
    refresh_current_profiles(session, players_list)

    new_league_output = []
    for p in players_list:
        if p["total"]["minutesPlayed"] < 90:
            continue

        def format_stats(b):
            d_tot = b["duelWon"] + b["duelLost"]
            d_pct = round((b["duelWon"] / d_tot) * 100) if d_tot > 0 else None
            a_tot = b["aerialWon"] + b["aerialLost"]
            a_pct = round((b["aerialWon"] / a_tot) * 100) if a_tot > 0 else None
            p_pct = round((b["accuratePass"] / b["totalPass"]) * 100) if b["totalPass"] > 0 else None

            drib_pct = None
            if p["position"] != "GK" and b["dribbleTotal"] > 0:
                drib_pct = round((b["dribbleWon"] / b["dribbleTotal"]) * 100)

            return {
                "matchesPlayed": b["matchesPlayed"],
                "minutesPlayed": b["minutesPlayed"],
                "goals": b["goals"],
                "assists": b["assists"],
                "shots": b["shots"],
                "keyPasses": b["keyPasses"],
                "tackles": b["tackles"],
                "interceptions": b["interceptions"],
                "saves": b["saves"],
                "dribbleWon": 0 if p["position"] == "GK" else b["dribbleWon"],
                "dribbleTotal": 0 if p["position"] == "GK" else b["dribbleTotal"],
                "dribbleSuccessRate": 0 if p["position"] == "GK" else drib_pct,
                "passAccPct": p_pct,
                "duelWinPct": d_pct,
                "aerialWinPct": a_pct,
            }

        new_league_output.append({
            "sofaId": p["sofaId"],
            "league": p["league"],
            "name": p["name"],
            "shortName": p["shortName"],
            "club": p["club"],
            "position": p["position"],
            "age": p["age"],
            "jerseyNumber": p["jerseyNumber"],
            "height": p["height"],
            "preferredFoot": p["preferredFoot"],
            "contractUntil": p.get("contractUntil", "—"),
            "countryCode": p.get("countryCode", ""),
            "isLegionnaire": p.get("countryCode", "").upper() not in ("", "KZ" if p["league"] == "KAZ" else "UZ"),
            "marketValueCurrency": p["marketValueCurrency"],
            "currentSeason": format_stats(p["current"]),
            "twoSeasons": format_stats(p["total"]),
        })

    # Аккуратное слияние с уже существующим файлом (чтобы не затирать Узбекистан!)
    existing_data = []
    if os.path.exists("data/superliga_stats.json"):
        try:
            with open("data/superliga_stats.json", "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            existing_data = []

    # Удаляем старые записи этой же лиги и добавляем свежие
    target_league_code = TARGET_TOURNAMENTS[0]["league"]
    filtered_existing = [item for item in existing_data if item.get("league") != target_league_code]
    combined_data = filtered_existing + new_league_output

    with open("data/superliga_stats.json", "w", encoding="utf-8") as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)

    uzb_count = sum(1 for p in combined_data if p["league"] == "UZB")
    kaz_count = sum(1 for p in combined_data if p["league"] == "KAZ")
    print(f"\n[УСПЕХ] База объединена! Всего игроков в файле: {len(combined_data)} (Узбекистан: {uzb_count}, Казахстан: {kaz_count})")

if __name__ == "__main__":
    sync_targeted_league()