"use client";
import React from "react";
import type { Appearance, CoreMatch, MatchCore } from "@/types/matches";
import type { Language, Player } from "@/types/players";
import { seasonTable, teamProgress, knownMatches } from "@/lib/dashboard";
import { LinePlot, MiniBars, SquadDonut } from "./dashboard-charts";
export function TeamDashboard({
  data,
  matches,
  rows,
  teamId,
  lang,
  players,
  onMatch,
  onRoster,
}: {
  data: MatchCore;
  matches: CoreMatch[];
  rows: Appearance[];
  teamId: number;
  lang: Language;
  players: Player[];
  onMatch: (m: CoreMatch) => void;
  onRoster: () => void;
}) {
  const ru = lang === "ru",
    t = (r: string, u: string) => (ru ? r : u),
    team = data.teams.find((v) => v.id === teamId),
    seasonId = matches[0]?.seasonId,
    table = seasonTable(data.matches.filter((m) => m.seasonId === seasonId)),
    stat = table.find((r) => r.id === teamId),
    known = knownMatches(matches),
    progress = teamProgress(matches, teamId),
    ids = [...new Set(rows.map((r) => r.playerId))],
    profiles = players.filter((p) => ids.includes(Number(p.id.split("-")[1]))),
    ages = profiles.filter((p) => typeof p.age === "number"),
    teams = new Map(data.teams.map((v) => [v.id, v.name]));
  const positions = ids.map((id) => {
    const minutes = new Map<string, number>();
    rows
      .filter((r) => r.playerId === id)
      .forEach((r) =>
        minutes.set(
          r.position || "UNKNOWN",
          (minutes.get(r.position || "UNKNOWN") || 0) + r.minutes,
        ),
      );
    return [...minutes].sort((a, b) => b[1] - a[1])[0]?.[0] || "UNKNOWN";
  });
  const groups = ["GK", "DF", "MF", "FW", "UNKNOWN"]
    .map((label) => ({
      label,
      value: positions.filter((p) => p === label).length,
    }))
    .filter((r) => r.value > 0);
  const buckets = [
    { label: "≤ 21", value: ages.filter((p) => p.age! <= 21).length },
    {
      label: "22–25",
      value: ages.filter((p) => p.age! >= 22 && p.age! <= 25).length,
    },
    {
      label: "26–29",
      value: ages.filter((p) => p.age! >= 26 && p.age! <= 29).length,
    },
    { label: "30+", value: ages.filter((p) => p.age! >= 30).length },
  ];
  return (
    <div className="team-dashboard">
      <div className="team-profile-card analysis-card">
        <div className="team-emblem">
          {team?.name?.slice(0, 2).toUpperCase() || "FC"}
        </div>
        <div>
          <span className="eyebrow">{matches[0]?.seasonName}</span>
          <h2>{team?.name}</h2>
          <p>
            {t(
              "Обзор сезона по доступным матчам",
              "Mavjud o‘yinlar bo‘yicha mavsum sharhi",
            )}
          </p>
        </div>
        <button className="action-secondary" onClick={onRoster}>
          {t("Состав команды", "Jamoa tarkibi")} →
        </button>
      </div>
      <div className="team-top-grid">
        <section className="analysis-card">
          <LinePlot
            title={t("Динамика сезона", "Mavsum dinamikasi")}
            series={[
              t("Очки", "Ochko"),
              t("Забито", "Urilgan"),
              t("Пропущено", "O‘tkazilgan"),
            ]}
            rows={progress.map((p) => ({
              label: new Date(p.date * 1000).toLocaleDateString(
                ru ? "ru-RU" : "uz-UZ",
                { day: "numeric", month: "short", timeZone: "Asia/Tashkent" },
              ),
              values: [p.points, p.gf, p.ga],
            }))}
          />
          <p className="muted">
            {t(
              "Накопительно по матчам с известным счётом",
              "Hisobi ma’lum o‘yinlar bo‘yicha jamlangan",
            )}
            : {known.length}/{matches.length}
          </p>
        </section>
        <section className="analysis-card points-card">
          <h3>{t("Результаты сезона", "Mavsum natijalari")}</h3>
          <strong>{stat?.points ?? "—"}</strong>
          <span>
            {t("очков в загруженных матчах", "yuklangan o‘yinlardagi ochko")}
          </span>
          <div className="result-tiles">
            {[stat?.won, stat?.drawn, stat?.lost].map((v, i) => (
              <div key={i}>
                <b>{v ?? "—"}</b>
                <small>
                  {
                    [
                      t("Победы", "G‘alaba"),
                      t("Ничьи", "Durang"),
                      t("Поражения", "Mag‘lubiyat"),
                    ][i]
                  }
                </small>
              </div>
            ))}
          </div>
          <p className="muted">
            {t(
              "Это расчёт по выборке, не официальная турнирная таблица.",
              "Bu tanlov hisobi, rasmiy turnir jadvali emas.",
            )}
          </p>
        </section>
      </div>
      <div className="team-kpis">
        {[
          {
            label: t("Матчи со счётом", "Hisobli o‘yinlar"),
            value: known.length,
          },
          {
            label: t("Забитые голы", "Urilgan gollar"),
            value: stat?.gf ?? "—",
          },
          { label: t("Пропущенные", "O‘tkazilgan"), value: stat?.ga ?? "—" },
          {
            label: t("Сухие матчи", "Golsiz o‘yinlar"),
            value: known.filter(
              (m) =>
                (m.homeTeamId === teamId ? m.awayScore : m.homeScore) === 0,
            ).length,
          },
        ].map((v) => (
          <article className="analysis-card" key={v.label}>
            <span>{v.label}</span>
            <strong>{v.value}</strong>
          </article>
        ))}
      </div>
      <div className="team-bottom-grid">
        <section className="analysis-card">
          <h3>{t("Последние матчи", "Oxirgi o‘yinlar")}</h3>
          <div className="dashboard-matches">
            {known.slice(0, 6).map((m) => (
              <button key={m.id} onClick={() => onMatch(m)}>
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
                <span>
                  {teams.get(m.homeTeamId)}
                  <small>{teams.get(m.awayTeamId)}</small>
                </span>
                <b>
                  {m.homeScore ?? "—"} : {m.awayScore ?? "—"}
                </b>
                <span>↗</span>
              </button>
            ))}
          </div>
        </section>
        <section className="analysis-card">
          <h3>{t("Состав по позициям", "Pozitsiyalar bo‘yicha tarkib")}</h3>
          <SquadDonut rows={groups} totalLabel={t("игроков", "futbolchi")} />
          <p className="muted">
            {t(
              "Основная широкая позиция по минутам в матчах",
              "O‘yinlardagi daqiqa bo‘yicha asosiy pozitsiya",
            )}
          </p>
        </section>
        <section className="analysis-card">
          <h3>{t("Возраст игроков", "Futbolchilar yoshi")}</h3>
          <MiniBars rows={buckets} />
          <p className="muted">
            {t("Текущий возраст известен", "Joriy yosh ma’lum")}: {ages.length}/
            {ids.length}
          </p>
          <h3>{t("Атака и защита", "Hujum va himoya")}</h3>
          {stat && (
            <MiniBars
              rows={[
                { label: t("Забито", "Urilgan"), value: stat?.gf || 0 },
                { label: t("Пропущено", "O‘tkazilgan"), value: stat?.ga || 0 },
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
