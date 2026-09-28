import json

with open("data/superliga_stats.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for item in data:
    l = item.get("league", "")
    if l in ["KZ", "KAZ"]:
        item["league"] = "KAZ"
    elif l in ["UZ", "UZB"]:
        item["league"] = "UZB"

with open("data/superliga_stats.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Ключи лиг стандартизированы: KAZ и UZB!")