"use client";
import React from "react";
import type { Language, League, Player, SeasonMode } from "@/types/players";
import type { AnalysisLocation } from "@/types/matches";
import { useMatchCore } from "@/hooks/use-match-core";
import { monthlyGoals, seasonTable, knownMatches } from "@/lib/dashboard";
import { LinePlot } from "./dashboard-charts";
import { PlayerAvatar } from "./player-avatar";
import { PercentileRadar } from "./profile-charts";
export function HomeDashboard({
  players,
  league,
  seasonMode,
  lang,
  onPlayer,
  onTeam,
  onPlayers,
  savedCount,
}: {
  players: Player[];
  league: League;
  seasonMode: SeasonMode;
  lang: Language;
  onPlayer: (p: Player) => void;
  onTeam: (v: AnalysisLocation) => void;
  onPlayers: () => void;
  savedCount: number;
}) {
  const { data, error, refresh } = useMatchCore(league),
    ru = lang === "ru",
    t = (r: string, u: string) => (ru ? r : u);
  const seasons = data?.seasons[league] || [],
    selectedIds = players[0]?.statsSeasonIds || [],
    fallback = seasonMode === "previous" ? seasons[1]?.id : seasons[0]?.id,
    ids = selectedIds.length ? selectedIds : [fallback],
    matches = (data?.matches || [])
      .filter((m) => ids.includes(m.seasonId))
      .sort((a, b) => b.date - a.date),
    teams = new Map(data?.teams.map((v) => [v.id, v.name]) || []),
    table = seasonTable(matches),
    trend = monthlyGoals(matches),
    scorers = players
      .filter((p) => p.goals !== null)
      .sort(
        (a, b) =>
          (b.goals ?? 0) - (a.goals ?? 0) || b.minutesPlayed - a.minutesPlayed,
      )
      .slice(0, 5),
    radarPlayer = players.find(
      (p) =>
        Object.values(p.radar).filter((v) => typeof v === "number").length >= 3,
    );
  return (
    <div className="home-dashboard">
      <div className="home-main">
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">UZSTAT · FOOTBALL ANALYTICS</span>
            <h1>
              {t(
                "Футбольные данные для точных решений",
                "Aniq qarorlar uchun futbol ma’lumotlari",
              )}
            </h1>
            <p>
              {t(
                "Изучайте игроков, сравнивайте показатели и следите за результатами команд.",
                "Futbolchilarni o‘rganing, ko‘rsatkichlarni taqqoslang va jamoa natijalarini kuzating.",
              )}
            </p>
            <div>
              <button className="action-primary" onClick={onPlayers}>
                {t("Поиск игроков", "Futbolchi qidirish")} →
              </button>
              <button
                className="action-secondary"
                onClick={() => {
                  const m = matches[0];
                  if (m)
                    onTeam({
                      league,
                      teamId: m.homeTeamId,
                      seasonId: m.seasonId,
                      matchId: 0,
                    });
                }}
                disabled={!matches.length}
              >
                {t("Команды", "Jamoalar")}
              </button>
            </div>
          </div>
          <div className="hero-pitch" aria-hidden="true">
            <div className="pitch-center" />
            <svg className="pitch-ball" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="29"
                fill="white"
                stroke="#294137"
                strokeWidth="2"
              />
              <path
                d="M32 19 44 28 39 42H25L20 28Z M7 22 17 25 15 37 4 40 M51 20 45 26 49 38 60 40 M20 57 25 45 39 45 46 57"
                fill="#213b30"
              />
            </svg>
            <div className="pitch-score">
              UZSTAT<span>FOOTBALL INTELLIGENCE</span>
            </div>
            <i />
            <i />
            <i />
          </div>
        </section>
        <section className="analysis-card">
          <div className="section-heading">
            <h3>
              {t("Последние завершённые матчи", "Oxirgi yakunlangan o‘yinlar")}
            </h3>
            <span className="context-chip">
              {seasons
                .filter((s) => ids.includes(s.id))
                .map((s) => s.name)
                .join(" · ") || "…"}
            </span>
          </div>
          {error ? (
            <p role="alert">
              {t("Не удалось загрузить матчи", "O‘yinlar yuklanmadi")}{" "}
              <button onClick={refresh}>
                {t("Повторить", "Qayta urinish")}
              </button>
            </p>
          ) : !data ? (
            <p className="muted">
              {t("Загрузка матчей…", "O‘yinlar yuklanmoqda…")}
            </p>
          ) : (
            <div className="home-match-grid">
              {knownMatches(matches)
                .slice(0, 3)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      onTeam({
                        league,
                        teamId: m.homeTeamId,
                        seasonId: m.seasonId,
                        matchId: m.id,
                      })
                    }
                  >
                    <time>
                      {new Date(m.date * 1000).toLocaleDateString(
                        ru ? "ru-RU" : "uz-UZ",
                        {
                          day: "numeric",
                          month: "short",
                          timeZone: "Asia/Tashkent",
                        },
                      )}
                    </time>
                    <div>
                      <span>{teams.get(m.homeTeamId)}</span>
                      <b>{m.homeScore ?? "—"}</b>
                    </div>
                    <div>
                      <span>{teams.get(m.awayTeamId)}</span>
                      <b>{m.awayScore ?? "—"}</b>
                    </div>
                    <small>{t("Открыть матч", "O‘yinni ochish")} ↗</small>
                  </button>
                ))}
              {!knownMatches(matches).length && (
                <p>
                  {t(
                    "Нет матчей выбранного периода",
                    "Tanlangan davrda o‘yin yo‘q",
                  )}
                </p>
              )}
            </div>
          )}
        </section>
        <div className="home-lower-grid">
          <section className="analysis-card">
            <div className="section-heading">
              <h3>{t("Бомбардиры", "To‘purarlar")}</h3>
              <button className="text-link" onClick={onPlayers}>
                {t("Все", "Barchasi")} →
              </button>
            </div>
            <div className="dashboard-player-list">
              {scorers.map((p, i) => (
                <button key={p.id} onClick={() => onPlayer(p)}>
                  <span>{i + 1}</span>
                  <PlayerAvatar player={p} lang={lang} />
                  <div>
                    <b>{p.name[lang]}</b>
                    <small>{p.club[lang]}</small>
                  </div>
                  <strong>{p.goals}</strong>
                </button>
              ))}
            </div>
            <p className="muted">
              {t(
                "Голы в загруженной статистике игроков",
                "Futbolchilarning yuklangan statistikasidagi gollar",
              )}
            </p>
          </section>
          <section className="analysis-card">
            <h3>{t("Команды", "Jamoalar")}</h3>
            <div className="dashboard-team-list">
              {table.slice(0, 5).map((v, i) => (
                <button
                  key={v.id}
                  onClick={() =>
                    onTeam({
                      league,
                      teamId: v.id,
                      seasonId: matches.find(
                        (m) => m.homeTeamId === v.id || m.awayTeamId === v.id,
                      )!.seasonId,
                      matchId: 0,
                    })
                  }
                >
                  <span>{i + 1}</span>
                  <span className="small-crest">
                    {teams.get(v.id)?.slice(0, 2)}
                  </span>
                  <b>{teams.get(v.id)}</b>
                  <strong>{v.points}</strong>
                </button>
              ))}
            </div>
            <p className="muted">
              {t(
                "Очки по доступным матчам. Не официальная таблица.",
                "Mavjud o‘yinlardagi ochko. Rasmiy jadval emas.",
              )}
            </p>
          </section>
        </div>
        <section className="analysis-card">
          <LinePlot
            title={t("Голы по месяцам", "Oylar bo‘yicha gollar")}
            rows={trend.map((r) => ({ label: r.date, values: [r.goals] }))}
            series={[t("Голы", "Gollar")]}
          />
          <p className="muted">
            {t(
              "Сумма голов матчей с известным счётом",
              "Hisobi ma’lum o‘yinlardagi gollar yig‘indisi",
            )}
          </p>
        </section>
      </div>
      <aside className="home-aside">
        <section className="analysis-card">
          <h3>{t("База в цифрах", "Baza raqamlarda")}</h3>
          <div className="home-number-grid">
            {[
              { n: players.length, label: t("Игроков", "Futbolchi") },
              {
                n: new Set(players.map((p) => p.club[lang])).size,
                label: t("Клубов игроков", "Futbolchi klublari"),
              },
              {
                n: knownMatches(matches).length,
                label: t("Матчей со счётом", "Hisobli o‘yin"),
              },
              {
                n: players.filter((p) => p.age !== null && p.age <= 21).length,
                label: "U21",
              },
            ].map((v) => (
              <div key={v.label}>
                <strong>{v.n}</strong>
                <span>{v.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="analysis-card">
          <h3>{t("Соревнование", "Musobaqa")}</h3>
          <div className="competition-badge">
            <span className="country-badge">
              {league === "UZB" ? "UZ" : "KZ"}
            </span>
            <div>
              <b>{league === "UZB" ? "Superliga" : "Premier League"}</b>
              <small>
                {seasons
                  .filter((s) => ids.includes(s.id))
                  .map((s) => s.name)
                  .join(" · ")}
              </small>
            </div>
          </div>
        </section>
        {radarPlayer && <PercentileRadar player={radarPlayer} lang={lang} />}
        <section className="analysis-card shortlist-summary">
          <span>☆</span>
          <h3>{t("Ваш шорт-лист", "Sizning ro‘yxatingiz")}</h3>
          <strong>{savedCount}</strong>
          <p>
            {t(
              "Сохраняйте игроков из профиля, чтобы вернуться к анализу.",
              "Tahlilga qaytish uchun futbolchilarni profildan saqlang.",
            )}
          </p>
        </section>
      </aside>
    </div>
  );
}
