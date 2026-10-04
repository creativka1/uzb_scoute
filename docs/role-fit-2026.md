# Real 2026 role audit

These reports run the actual players API and ranking function against the committed dataset. They do not fabricate confirmed positions or fill missing statistics with zero.

## Findings

The loaded UZB current-season dataset contains 455 players; KAZ contains 357. The narrow position policy admits only explicitly confirmed source positions. UZB has one confirmed GK and one ST; other requested roles have no confirmed candidates. KAZ has no confirmed narrow roles for these lists. A trustworthy confirmed TOP-10 is therefore unavailable for most roles.

| League | Role | Confirmed candidates |
| --- | --- | --- |
| UZB | GK | 1 |
| UZB | CB | 0 |
| UZB | DM | 0 |
| UZB | WINGER | 0 |
| UZB | ST | 1 |
| KAZ | GK | 0 |
| KAZ | CB | 0 |
| KAZ | DM | 0 |
| KAZ | WINGER | 0 |
| KAZ | ST | 0 |

## role-v3 changes

- Winger needs accept confirmed RW/RM and LW/LM across MF/FW without rewriting a player’s source position. The same-side pairing preserves a right/left requirement.
- Profile scoring uses sample-adjusted percentiles already computed by the players API. Raw small-sample extremes no longer bypass that adjustment.
- A candidate with neither usable role metrics nor a broad-role score is excluded; missing evidence is not converted into a numerical zero score.
- Unconfirmed narrow positions require an explicit opt-in and are marked `position:unconfirmed`. They receive no confirmed-position contribution. This preliminary view is for further scouting, not a verified recruitment recommendation.
- Profile weights remain unchanged: the current narrow-position evidence cannot support empirical weight tuning.

## Preliminary TOP-10

Open **Поиск под задачу → Проверка ролей · TOP-10**, choose a role and enable **Включить игроков с неподтверждённой точной позицией**. These lists use real 2026 values; the proposed narrow role remains unverified. Coverage is the percentage of profile metric weights available, not overall season completeness or a probability of success.

### UZB · GK

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Azizkhon Isokov | Bukhoro | 532 | 75 | 100% | Unconfirmed |
| 2 | Samandar Jurabekov | Mashal | 360 | 71 | 100% | Unconfirmed |
| 3 | Umid Ergashev | Xorazm | 630 | 71 | 100% | Unconfirmed |
| 4 | Abdumavlon Abduzhalilov | Bunyodkor | 990 | 70 | 100% | Unconfirmed |
| 5 | Farkhod Rakhmatov | Qizilqum | 1890 | 67 | 100% | Unconfirmed |
| 6 | Federico Botti | Bunyodkor | 900 | 65 | 100% | Unconfirmed |
| 7 | Doston Tukhtaboev | Mashal | 1306 | 64 | 100% | Unconfirmed |
| 8 | Abduvokhid Nematov | Nasaf | 1800 | 62 | 100% | Unconfirmed |
| 9 | Otabek Boymurodov | Surkhon Termez | 891 | 62 | 100% | Confirmed |
| 10 | Edem Nemanov | Dinamo | 1800 | 58 | 100% | Unconfirmed |

### UZB · CB

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Mihail Stefan | Dinamo | 990 | 71 | 90% | Unconfirmed |
| 2 | Shahzod Toirov | OKMK | 709 | 70 | 90% | Unconfirmed |
| 3 | Avazbek Ulmasaliyev | OKMK | 1679 | 70 | 90% | Unconfirmed |
| 4 | Oleksandr Kucherenko | Lokomotiv | 1665 | 69 | 90% | Unconfirmed |
| 5 | Zaid Tahseen | Pakhtakor | 1255 | 69 | 90% | Unconfirmed |
| 6 | Muhammadrasul Abdumajidov | Pakhtakor | 1620 | 67 | 90% | Unconfirmed |
| 7 | Bekhruz Shukurullaev | Surkhon Termez | 1148 | 66 | 90% | Unconfirmed |
| 8 | Alibek Davronov | Nasaf | 1035 | 66 | 90% | Unconfirmed |
| 9 | Filip Ivanović | Sogdiyona | 1354 | 64 | 90% | Unconfirmed |
| 10 | Kuvonchbek Khushvaktov | Nasaf | 745 | 62 | 90% | Unconfirmed |

### UZB · DM

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Abdurauf Buriev | Pakhtakor | 1363 | 75 | 85% | Unconfirmed |
| 2 | Kuvondik Ruziev | Bukhoro | 957 | 74 | 85% | Unconfirmed |
| 3 | Rasul Yuldashev | Dinamo | 914 | 74 | 85% | Unconfirmed |
| 4 | Oybek Rustamov | Nasaf | 1797 | 73 | 85% | Unconfirmed |
| 5 | Ratinho | Neftchi | 959 | 73 | 85% | Unconfirmed |
| 6 | Ikram Alibaev | Neftchi | 1066 | 73 | 85% | Unconfirmed |
| 7 | Dragan Ceran | Andijan | 983 | 72 | 85% | Unconfirmed |
| 8 | Tigran Avanesyan | Dinamo | 555 | 69 | 85% | Unconfirmed |
| 9 | Sardorbek Bakhromov | Nasaf | 1403 | 69 | 85% | Unconfirmed |
| 10 | Khumoyunmirzo Iminov | Andijan | 805 | 67 | 85% | Unconfirmed |

### UZB · WINGER

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tigran Avanesyan | Dinamo | 555 | 73 | 56% | Unconfirmed |
| 2 | Vladimir Jovović | Neftchi | 1003 | 71 | 81% | Unconfirmed |
| 3 | Temurkhuja Abdukholikov | Lokomotiv | 1650 | 70 | 65% | Unconfirmed |
| 4 | Imeda Ashortia | Andijan | 900 | 69 | 56% | Unconfirmed |
| 5 | Kuvondik Ruziev | Bukhoro | 957 | 68 | 56% | Unconfirmed |
| 6 | Jovan Đokić | Neftchi | 1038 | 67 | 56% | Unconfirmed |
| 7 | Asadbek Rakhimjonov | Navbahor | 1346 | 66 | 56% | Unconfirmed |
| 8 | Haris Hajdarević | Dinamo | 443 | 65 | 56% | Unconfirmed |
| 9 | Arihiro Sentoku | OKMK | 1094 | 65 | 56% | Unconfirmed |
| 10 | Rafael Sabino | Xorazm | 1411 | 65 | 56% | Unconfirmed |

### UZB · ST

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Temurkhuja Abdukholikov | Lokomotiv | 1650 | 75 | 90% | Unconfirmed |
| 2 | Khuisain Norchaev | Navbahor | 792 | 71 | 90% | Unconfirmed |
| 3 | Zoran Marušić | Neftchi | 925 | 71 | 90% | Unconfirmed |
| 4 | Rustam Turdimurodov | Andijan | 931 | 64 | 90% | Unconfirmed |
| 5 | Anvar Khozhimirzaev | Dinamo | 1054 | 63 | 90% | Unconfirmed |
| 6 | Stephen Chinedu | Pakhtakor | 1365 | 62 | 90% | Unconfirmed |
| 7 | Stipe Perica | Neftchi | 1082 | 61 | 90% | Unconfirmed |
| 8 | Fejsal Mulić | Sogdiyona | 830 | 59 | 90% | Unconfirmed |
| 9 | Bobir Abdikholikov | Nasaf | 1736 | 59 | 90% | Unconfirmed |
| 10 | Kuvonch Abraev | Lokomotiv | 564 | 57 | 90% | Unconfirmed |

### KAZ · GK

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Aleksandr Zarutskiy | Актобе | 900 | 69 | 100% | Unconfirmed |
| 2 | Sultan Busurmanov | Тобыл | 360 | 65 | 100% | Unconfirmed |
| 3 | Danil Ustimenko | Тобыл | 540 | 65 | 100% | Unconfirmed |
| 4 | Miroslav Lobantsev | Окжетпес | 900 | 65 | 100% | Unconfirmed |
| 5 | Dmytro Nepohodov | Улытау | 900 | 64 | 100% | Unconfirmed |
| 6 | Nurasyl Tokhtarov | Атырау | 360 | 62 | 100% | Unconfirmed |
| 7 | Ștefan Sicaci | Жетысу | 900 | 58 | 100% | Unconfirmed |
| 8 | Bogdan Sarnavskyi | Иртыш | 360 | 57 | 100% | Unconfirmed |
| 9 | Miras Rikhard | Иртыш | 540 | 57 | 100% | Unconfirmed |
| 10 | Dumitru Celeadnic | Кызылжар | 810 | 55 | 100% | Unconfirmed |

### KAZ · CB

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Ivan Kuzmichev | Окжетпес | 786 | 75 | 90% | Unconfirmed |
| 2 | Sergey Maliy | Ордабасы | 797 | 72 | 90% | Unconfirmed |
| 3 | Diego Luna | Жетысу | 806 | 67 | 90% | Unconfirmed |
| 4 | Klaidher Macedo | Кайсар | 900 | 65 | 90% | Unconfirmed |
| 5 | Temirlan Yerlanov | Актобе | 634 | 64 | 85% | Unconfirmed |
| 6 | Borys Lototskyi | Окжетпес | 769 | 64 | 90% | Unconfirmed |
| 7 | Egor Khvalko | Атырау | 567 | 63 | 90% | Unconfirmed |
| 8 | Ivan Ordets | Актобе | 450 | 62 | 85% | Unconfirmed |
| 9 | Glib Bukhal | Улытау | 659 | 62 | 85% | Unconfirmed |
| 10 | Stefan Bukorac | Кайсар | 798 | 62 | 90% | Unconfirmed |

### KAZ · DM

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Pablo Alvarez | Актобе | 711 | 70 | 100% | Unconfirmed |
| 2 | Tsotne Mosiashvili | Жетысу | 886 | 70 | 85% | Unconfirmed |
| 3 | Adam Adakhajiev | Жетысу | 644 | 64 | 85% | Unconfirmed |
| 4 | Hrvoje Ilić | Елимай | 803 | 64 | 85% | Unconfirmed |
| 5 | David Abagna | Ордабасы | 956 | 64 | 100% | Unconfirmed |
| 6 | Jaakko Oksanen | Кайрат | 531 | 63 | 75% | Unconfirmed |
| 7 | Stanislav Basmanov | Астана | 607 | 63 | 85% | Unconfirmed |
| 8 | Dmitri Borodin | Окжетпес | 804 | 62 | 85% | Unconfirmed |
| 9 | Mihai Căpățînă | Ордабасы | 725 | 61 | 85% | Unconfirmed |
| 10 | Ersultan Kaldybekov | Кайсар | 557 | 60 | 85% | Unconfirmed |

### KAZ · WINGER

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Dmitri Borodin | Окжетпес | 804 | 71 | 56% | Unconfirmed |
| 2 | Hrvoje Ilić | Елимай | 803 | 69 | 56% | Unconfirmed |
| 3 | Pablo Alvarez | Актобе | 711 | 66 | 81% | Unconfirmed |
| 4 | Léo Natel | Ордабасы | 754 | 66 | 65% | Unconfirmed |
| 5 | Bauyrzhan Islamkhan | Астана | 606 | 64 | 81% | Unconfirmed |
| 6 | Sayan Mukanov | Окжетпес | 607 | 64 | 56% | Unconfirmed |
| 7 | David Abagna | Ордабасы | 956 | 64 | 81% | Unconfirmed |
| 8 | Everton Macedo Moraes | Ордабасы | 354 | 63 | 65% | Unconfirmed |
| 9 | Elisey Gorshunov | Алтай | 536 | 61 | 81% | Unconfirmed |
| 10 | Keba Sylla | Каспий | 443 | 60 | 65% | Unconfirmed |

### KAZ · ST

| # | Player | Club | Minutes | Fit | Profile coverage | Exact role |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Oralkhan Omirtaev | Окжетпес | 602 | 67 | 90% | Unconfirmed |
| 2 | Marc Gual | Кайрат | 574 | 66 | 90% | Unconfirmed |
| 3 | Björn Johnsen | Ордабасы | 971 | 64 | 90% | Unconfirmed |
| 4 | Vitaliy Lisakovich | Тобыл | 538 | 63 | 90% | Unconfirmed |
| 5 | Léo Natel | Ордабасы | 754 | 63 | 90% | Unconfirmed |
| 6 | Everton Macedo Moraes | Ордабасы | 354 | 61 | 90% | Unconfirmed |
| 7 | Andrija Filipović | Женис | 774 | 61 | 90% | Unconfirmed |
| 8 | Keba Sylla | Каспий | 443 | 59 | 90% | Unconfirmed |
| 9 | Uroš Milovanović | Тобыл | 811 | 59 | 90% | Unconfirmed |
| 10 | Artur Shushenachev | Актобе | 872 | 58 | 90% | Unconfirmed |

## Reproduce

Install dependencies, then run `node scripts/audit_role_fit.cjs`. JSON reports are in `docs/audits/`. The original strict `role-v2` report is retained for comparison.

The next prerequisite for real role calibration is source-backed position enrichment; it is not safe to infer an exact position from an unverified formation array or heatmap orientation.
