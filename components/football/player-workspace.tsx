"use client";
import React, { useState } from "react";
import type { Player, Language } from "@/types/players";
import type { AnalysisLocation } from "@/types/matches";
import { useMatchCore } from "@/hooks/use-match-core";
import { PlayerAvatar } from "./player-avatar";
import { HeadToHead } from "./profile-charts";
import { LinePlot } from "./dashboard-charts";
export function PlayerWorkspace({
  player,
  players,
  lang,
  comparison,
  onComparison,
  onSelect,
  children,
}: {
  player: Player;
  players: Player[];
  lang: Language;
  comparison: Player | null;
  onComparison: (p: Player) => void;
  onSelect: (p: Player) => void;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState(""),
    ru = lang === "ru",
    options = players.filter(
      (p) =>
        p.id !== player.id &&
        p.position === player.position &&
        p.league === player.league &&
        JSON.stringify(p.statsSeasonIds) ===
          JSON.stringify(player.statsSeasonIds),
    ),
    other = options.find((p) => p.id === comparison?.id),
    list = players.filter(
      (p) =>
        p.league === player.league &&
        JSON.stringify(p.statsSeasonIds) ===
          JSON.stringify(player.statsSeasonIds) &&
        `${p.name[lang]} ${p.club[lang]}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <section className="player-workspace">
      <aside className="profile-player-list analysis-card">
        <h2>{ru ? "Игроки" : "Futbolchilar"}</h2>
        <p className="muted">
          {list.length} · {player.statsSeasonLabel}
        </p>
        <input
          aria-label={
            ru ? "Поиск в списке игроков" : "Futbolchilar ro‘yxatida qidirish"
          }
          placeholder={ru ? "Поиск игрока…" : "Futbolchi qidirish…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div>
          {list.map((p) => (
            <button
              key={p.id}
              aria-pressed={p.id === player.id}
              onClick={() => onSelect(p)}
            >
              <PlayerAvatar player={p} lang={lang} />
              <span>
                <b>{p.name[lang]}</b>
                <small>{p.club[lang]}</small>
                <em>{p.detailedPosition || p.position}</em>
              </span>
              <strong>{p.scoutingEngine.roleScore ?? "—"}</strong>
            </button>
          ))}
        </div>
      </aside>
      <div className="profile-center">{children}</div>
      <aside className="profile-comparison analysis-card">
        <h3>{ru ? "Сравнение игроков" : "Futbolchilar taqqoslovi"}</h3>
        <label className="comparison-select">
          {ru
            ? "Та же позиция, лига и период"
            : "Bir xil pozitsiya, liga va davr"}
          <select
            value={other?.id || ""}
            onChange={(e) => {
              const p = options.find((x) => x.id === e.target.value);
              if (p) onComparison(p);
            }}
          >
            <option value="" disabled>
              {ru ? "Выберите игрока" : "Futbolchini tanlang"}
            </option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name[lang]}
              </option>
            ))}
          </select>
        </label>
        {other ? (
          <>
            <div className="pinned-identities">
              {[player, other].map((p) => (
                <div key={p.id}>
                  <PlayerAvatar player={p} lang={lang} />
                  <b>{p.name[lang]}</b>
                  <small>{p.club[lang]}</small>
                  <span>{p.detailedPosition || p.position}</span>
                </div>
              ))}
            </div>
            <HeadToHead player={player} comparison={other} lang={lang} />
          </>
        ) : (
          <div className="compare-placeholder">
            <span>⇄</span>
            <p>
              {ru
                ? "Выберите второго игрока для сравнения показателей."
                : "Ko‘rsatkichlarni taqqoslash uchun ikkinchi futbolchini tanlang."}
            </p>
          </div>
        )}
        <div className="tracking-unavailable">
          <h3>
            {ru ? "Тепловая карта и удары" : "Issiqlik xaritasi va zarbalar"}
          </h3>
          <div className="empty-pitch" aria-hidden="true">
            <i />
          </div>
          <p className="muted">
            {ru
              ? "Координаты действий не предоставлены текущим источником."
              : "Joriy manba harakat koordinatalarini taqdim etmagan."}
          </p>
        </div>
      </aside>
    </section>
  );
}
export function PlayerRecentForm({
  player,
  lang,
  onOpenMatch,
}: {
  player: Player;
  lang: Language;
  onOpenMatch?: (v: AnalysisLocation) => void;
}) {
  const { data, error, refresh } = useMatchCore(player.league),
    ru = lang === "ru";
  if (error)
    return (
      <p role="alert">
        {ru ? "Матчи не загрузились." : "O‘yinlar yuklanmadi."}{" "}
        <button onClick={refresh}>{ru ? "Повторить" : "Qayta urinish"}</button>
      </p>
    );
  if (!data)
    return (
      <p className="muted">
        {ru ? "Загрузка матчей…" : "O‘yinlar yuklanmoqda…"}
      </p>
    );
  const events = new Map(
      data.matches
        .filter((m) => player.statsSeasonIds?.includes(m.seasonId))
        .map((m) => [m.id, m]),
    ),
    rows = data.appearances
      .filter(
        (a) =>
          events.has(a.matchId) &&
          a.playerId === Number(player.id.split("-")[1]),
      )
      .sort((a, b) => events.get(b.matchId)!.date - events.get(a.matchId)!.date)
      .slice(0, 10),
    teams = new Map(data.teams.map((t) => [t.id, t.name]));
  const date = (n: number) =>
    new Date(n * 1000).toLocaleDateString(ru ? "ru-RU" : "uz-UZ", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Tashkent",
    });
  return (
    <div className="player-form-grid">
      <section className="analysis-card">
        <h3>{ru ? "Последние матчи" : "Oxirgi o‘yinlar"}</h3>
        <div className="dashboard-matches">
          {rows.slice(0, 5).map((a) => {
            const m = events.get(a.matchId)!;
            return (
              <button
                key={a.id}
                disabled={!onOpenMatch}
                onClick={() =>
                  onOpenMatch?.({
                    league: player.league,
                    teamId: a.teamId,
                    seasonId: m.seasonId,
                    matchId: m.id,
                  })
                }
              >
                <time>{date(m.date)}</time>
                <span>
                  {teams.get(
                    m.homeTeamId === a.teamId ? m.awayTeamId : m.homeTeamId,
                  )}
                </span>
                <b>
                  {m.homeScore ?? "—"}:{m.awayScore ?? "—"}
                </b>
                <small>{a.minutes}′</small>
              </button>
            );
          })}
        </div>
        {!rows.length && (
          <p className="muted">
            {ru
              ? "Нет истории выбранного периода"
              : "Tanlangan davr tarixi yo‘q"}
          </p>
        )}
      </section>
      <section className="analysis-card">
        <LinePlot
          title={ru ? "xG и xA по матчам" : "O‘yinlar bo‘yicha xG va xA"}
          series={["xG", "xA"]}
          rows={rows
            .slice()
            .reverse()
            .map((a) => ({
              label: date(events.get(a.matchId)!.date),
              values: [a.stats.xG ?? null, a.stats.xA ?? null],
            }))}
        />
        <p className="muted">
          {ru
            ? "Последние 10 доступных участий. Пропуски не соединяются."
            : "Oxirgi 10 mavjud ishtirok. Bo‘sh qiymatlar ulanmaydi."}
        </p>
      </section>
    </div>
  );
}
