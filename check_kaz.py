import json

with open("data/superliga_stats.json", "r", encoding="utf-8") as f:
    data = json.load(f)

kaz_players = [p for p in data if p.get("league") == "KAZ"]
uzb_players = [p for p in data if p.get("league") == "UZB"]

print(f"Всего игроков в файле: {len(data)}")
print(f"Игроков с лигой UZB: {len(uzb_players)}")
print(f"Игроков с лигой KAZ: {len(kaz_players)}")