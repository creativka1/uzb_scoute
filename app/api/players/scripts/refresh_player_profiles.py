import json
import os
import time
from datetime import datetime
from curl_cffi import requests

DATA_FILE = os.path.join("data", "superliga_stats.json")
CACHE_DIR = os.path.join("data", "cache", "players")
CACHE_TTL = 24 * 3600
BATCH_DELAY = 0.08
REQUEST_TIMEOUT = 10


def get_cached_profile(player_id):
    path = os.path.join(CACHE_DIR, f"{player_id}.json")
    if not os.path.exists(path):
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            cached = json.load(f)
        if time.time() - cached.get("_cachedAt", 0) < CACHE_TTL:
            return cached.get("player") or {}
    except Exception:
        pass
    return None


def save_cached_profile(player_id, player):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{player_id}.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {"_cachedAt": time.time(), "player": player},
                f,
                ensure_ascii=False,
            )
    except Exception:
        pass


def format_contract_date(timestamp):
    if not timestamp:
        return "—"
    try:
        return datetime.fromtimestamp(int(timestamp)).strftime("%d/%m/%Y")
    except Exception:
        return "—"


def fetch_profile(session, player_id):
    cached = get_cached_profile(player_id)
    if cached is not None:
        return cached

    url = f"https://www.sofascore.com/api/v1/player/{player_id}"

    for attempt in range(3):
        try:
            response = session.get(url, timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                player = (response.json() or {}).get("player") or {}
                if player:
                    save_cached_profile(player_id, player)
                    return player

            if response.status_code in (429, 403):
                time.sleep(1.5 * (attempt + 1))
            else:
                time.sleep(0.5)
        except Exception:
            time.sleep(0.8)

    return {}


def refresh():
    if not os.path.exists(DATA_FILE):
        raise FileNotFoundError(DATA_FILE)

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        players = json.load(f)

    session = requests.Session(impersonate="chrome120")
    changed = 0
    failed = 0

    print(f"[INFO] Обновление профилей: {len(players)} игроков")

    for index, player in enumerate(players, start=1):
        player_id = player.get("sofaId")
        if not player_id:
            failed += 1
            continue

        profile = fetch_profile(session, player_id)
        if not profile:
            failed += 1
            continue

        before = (
            player.get("club"),
            player.get("marketValueCurrency"),
            player.get("contractUntil"),
            player.get("countryCode"),
            player.get("preferredFoot"),
            player.get("height"),
            player.get("jerseyNumber"),
        )

        team = profile.get("team") or {}
        if team.get("name"):
            player["club"] = team["name"]

        market_raw = (profile.get("proposedMarketValueRaw") or {}).get("value")
        if market_raw is None:
            market_raw = profile.get("marketValue")
        if market_raw is not None:
            player["marketValueCurrency"] = market_raw

        contract_ts = profile.get("contractUntilTimestamp")
        if contract_ts:
            player["contractUntil"] = format_contract_date(contract_ts)

        country = profile.get("country") or {}
        if country.get("alpha2"):
            player["countryCode"] = country["alpha2"].upper()

        if profile.get("preferredFoot"):
            player["preferredFoot"] = profile["preferredFoot"]
        if profile.get("height"):
            player["height"] = profile["height"]
        if profile.get("jerseyNumber") is not None:
            player["jerseyNumber"] = profile["jerseyNumber"]

        league = player.get("league")
        country_code = str(player.get("countryCode") or "").upper()
        local_country = "KZ" if league == "KAZ" else "UZ" if league == "UZB" else ""
        if country_code and local_country:
            player["isLegionnaire"] = country_code != local_country

        after = (
            player.get("club"),
            player.get("marketValueCurrency"),
            player.get("contractUntil"),
            player.get("countryCode"),
            player.get("preferredFoot"),
            player.get("height"),
            player.get("jerseyNumber"),
        )
        if before != after:
            changed += 1

        if index % 50 == 0:
            print(f"[INFO] {index}/{len(players)}")

        time.sleep(BATCH_DELAY)

    temp_file = DATA_FILE + ".tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(temp_file, DATA_FILE)

    print(f"[SUCCESS] Изменено профилей: {changed}; ошибок API: {failed}")


if __name__ == "__main__":
    refresh()
