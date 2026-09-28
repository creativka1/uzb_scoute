import json
import random

CLUBS = {
    "pakhtakor": {"uz": "Paxtakor", "ru": "Пахтакор"},
    "nasaf": {"uz": "Nasaf", "ru": "Насаф"},
    "bunyodkor": {"uz": "Bunyodkor", "ru": "Бунёдкор"},
    "olympic": {"uz": "Olimpik", "ru": "Олимпик"},
    "navbahor": {"uz": "Navbahor", "ru": "Навбахор"}
}

# Шаблон команды с реальными игроками и амплуа
TEAM_ROSTER = [
    # Вратари
    {"name_uz": "Eldor Suyunov", "name_ru": "Элдор Суюнов", "pos": "GK", "num": 35, "age": 33, "val": "€300k"},
    {"name_uz": "Nikita Shevchenko", "name_ru": "Никита Шевченко", "pos": "GK", "num": 1, "age": 20, "val": "€150k"},
    # Защитники
    {"name_uz": "Doston Tursunov", "name_ru": "Достон Турсунов", "pos": "DF", "num": 3, "age": 28, "val": "€500k"},
    {"name_uz": "Dilshod Saitov", "name_ru": "Дильшод Саитов", "pos": "DF", "num": 34, "age": 24, "val": "€600k"},
    {"name_uz": "Shahzod Azmiddinov", "name_ru": "Шахзод Азмиддинов", "pos": "DF", "num": 5, "age": 23, "val": "€450k"},
    {"name_uz": "Hojiakbar Alijonov", "name_ru": "Хожиакбар Алижонов", "pos": "DF", "num": 33, "age": 26, "val": "€1.0m"},
    # Полузащитники
    {"name_uz": "Diyor Xolmatov", "name_ru": "Диёр Холматов", "pos": "MF", "num": 8, "age": 21, "val": "€850k", "photo": "/players/4.jpg"},
    {"name_uz": "Sardor Sobirxo'jayev", "name_ru": "Сардор Собирходжаев", "pos": "MF", "num": 7, "age": 29, "val": "€700k"},
    {"name_uz": "Bekhruz Askarov", "name_ru": "Бехруз Аскаров", "pos": "MF", "num": 28, "age": 20, "val": "€350k"},
    {"name_uz": "Doniyor Abdumannopov", "name_ru": "Дониёр Абдуманнопов", "pos": "MF", "num": 11, "age": 23, "val": "€400k"},
    # Нападающие
    {"name_uz": "Muhammadali O'rinboyev", "name_ru": "Мухаммадали Уринбоев", "pos": "FW", "num": 17, "age": 19, "val": "€600k", "photo": "/players/5.png"},
    {"name_uz": "Igor Sergeev", "name_ru": "Игорь Сергеев", "pos": "FW", "num": 9, "age": 31, "val": "€900k"},
    {"name_uz": "Po'latxo'ja Xoldorxonov", "name_ru": "Пулатходжа Холдорхонов", "pos": "FW", "num": 77, "age": 21, "val": "€400k"},
]

def generate_radar(pos):
    """Генерация реалистичного радара в зависимости от позиции"""
    if pos == "FW":
        return {
            "finishing": random.randint(75, 95), "creativity": random.randint(60, 80),
            "dribbling": random.randint(65, 88), "defending": random.randint(25, 45),
            "physicality": random.randint(65, 85), "passing": random.randint(55, 75)
        }
    elif pos == "MF":
        return {
            "finishing": random.randint(50, 75), "creativity": random.randint(75, 95),
            "dribbling": random.randint(70, 90), "defending": random.randint(55, 75),
            "physicality": random.randint(60, 80), "passing": random.randint(80, 96)
        }
    elif pos == "DF":
        return {
            "finishing": random.randint(20, 50), "creativity": random.randint(40, 65),
            "dribbling": random.randint(45, 70), "defending": random.randint(78, 95),
            "physicality": random.randint(75, 95), "passing": random.randint(60, 82)
        }
    else:  # GK
        return {
            "finishing": 10, "creativity": 30, "dribbling": 20,
            "defending": 90, "physicality": 80, "passing": 65
        }

def generate_shotmap(goals, count=8):
    shots = []
    for i in range(count):
        is_goal = i < goals
        shots.append({
            "id": f"s-{random.randint(1000, 9999)}",
            "x": random.randint(25, 75),
            "y": random.randint(6, 28),
            "xG": round(random.uniform(0.18, 0.75) if is_goal else random.uniform(0.04, 0.35), 2),
            "result": "goal" if is_goal else random.choice(["saved", "missed", "blocked"]),
            "minute": random.randint(5, 90),
            "opponent": random.choice(["Nasaf", "Navbahor", "Bunyodkor", "Neftchi"]),
            "bodyPart": random.choice(["right_foot", "left_foot", "head"])
        })
    return shots

players_data = []

for idx, p in enumerate(TEAM_ROSTER):
    is_u21 = p["age"] <= 21
    goals = random.randint(4, 9) if p["pos"] == "FW" else (random.randint(1, 4) if p["pos"] == "MF" else random.randint(0, 2))
    assists = random.randint(3, 8) if p["pos"] == "MF" else random.randint(0, 3)
    
    player_obj = {
        "id": f"uz-pakhtakor-{idx+1:02d}",
        "name": {"uz": p["name_uz"], "ru": p["name_ru"]},
        "age": p["age"],
        "isU21": is_u21,
        "club": CLUBS["pakhtakor"],
        "position": p["pos"],
        "number": p["num"],
        "height": random.randint(175, 190),
        "marketValue": p["val"],
        "contractUntil": "12/2026",
        "photoUrl": p.get("photo", ""),
        "initials": "".join([part[0] for part in p["name_uz"].split()]),
        "scoutIndex": random.randint(82, 95) if is_u21 else random.randint(70, 85),
        "tags": ["Prospect", "Superliga"] if is_u21 else ["First Team"],
        "minutesPlayed": random.randint(800, 1500),
        "matchesPlayed": random.randint(10, 18),
        "goals": goals,
        "assists": assists,
        "xG": round(goals * random.uniform(0.85, 1.15), 2),
        "xA": round(assists * random.uniform(0.8, 1.2), 2),
        "shotsPer90": round(random.uniform(1.2, 3.5), 1),
        "keyPassesPer90": round(random.uniform(0.8, 3.2), 1),
        "dribbleSuccessRate": random.randint(55, 78),
        "duelWinRate": random.randint(48, 76),
        "progressiveRunsPer90": round(random.uniform(1.5, 4.5), 1),
        "aerialWinRate": random.randint(40, 75),
        "radar": generate_radar(p["pos"]),
        "shotMap": generate_shotmap(goals)
    }
    players_data.append(player_obj)

with open("data/players.json", "w", encoding="utf-8") as f:
    json.dump(players_data, f, ensure_ascii=False, indent=2)

print(f"Успешно сгенерирован состав из {len(players_data)} игроков в data/players.json!")