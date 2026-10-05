"use client";
import React from "react";
import { radarSeries, radarMetrics } from "@/lib/radar";
import type { Player, Language, Position } from "@/types/players";
const labels: Record<string, [string, string]> = {
  savesPer90: ["Сейвы / 90", "Seyvlar / 90"],
  passAccPct: ["Точность паса", "Pas aniqligi"],
  tacklesPer90: ["Отборы / 90", "To‘p qaytarish / 90"],
  interceptionsPer90: ["Перехваты / 90", "To‘xtatish / 90"],
  dribbleSuccessPct: ["Дриблинг, %", "Dribling, %"],
  keyPassesPer90: ["Ключевые пасы / 90", "Asosiy paslar / 90"],
  assistsPer90: ["Ассисты / 90", "Assistlar / 90"],
  goalsPer90: ["Голы / 90", "Gollar / 90"],
  shotsPer90: ["Удары / 90", "Zarbalar / 90"],
};
const keys = radarMetrics;
const fmt = (n: number | null | undefined, pct = false) =>
  typeof n === "number" && Number.isFinite(n)
    ? `${n.toFixed(pct ? 1 : 2)}${pct ? "%" : ""}`
    : "—";
export function PercentileRadar({
  player,
  comparison,
  lang,
}: {
  player: Player;
  comparison?: Player;
  lang: Language;
}) {
  const ru = lang === "ru",
    series = radarSeries(player, comparison),
    axes = series.axes.map((a) => a.key),
    values = series.axes.map((a) => a.value),
    other = series.axes.map((a) => a.other);
  const full = axes.length >= 3,
    otherFull = series.compare;
  const point = (i: number, v: number, r = 104) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
    return [
      210 + (Math.cos(angle) * r * v) / 100,
      168 + (Math.sin(angle) * r * v) / 100,
    ];
  };
  const polygon = (v: (number | null)[]) =>
    v.map((n, i) => point(i, n ?? 0).join(",")).join(" ");
  return (
    <section className="analysis-card percentile-card">
      <div className="chart-heading">
        <h3>{ru ? "Радар процентилей" : "Percentil radari"}</h3>
        <span className="chart-chip">
          {player.position} · {player.statsSeasonLabel}
        </span>
      </div>
      <p className="muted">
        {ru
          ? "Процентили своей позиции и лиги · шкала 0–100"
          : "O‘z pozitsiyasi va ligasi percentillari · shkala 0–100"}{" "}
        · {axes.length}/{series.total}
      </p>
      {axes.length >= 3 ? (
        <svg
          className="percentile-radar"
          viewBox="0 0 420 350"
          role="img"
          aria-label={
            ru
              ? "Процентили ролевых показателей, от 0 до 100"
              : "Rol ko‘rsatkichlarining 0 dan 100 gacha percentillari"
          }
        >
          {[20, 40, 60, 80, 100].map((v) => (
            <circle
              key={v}
              cx="210"
              cy="168"
              r={(104 * v) / 100}
              fill="none"
              stroke="#e5ecf1"
            />
          ))}
          {axes.map((key, i) => {
            const [x, y] = point(i, 100),
              [lx, ly] = point(i, 100, 142);
            return (
              <g key={key}>
                <line x1="210" y1="168" x2={x} y2={y} stroke="#e5ecf1" />
                <text
                  x={lx}
                  y={ly - 7}
                  textAnchor="middle"
                  className="radar-label"
                >
                  {labels[key][ru ? 0 : 1]}
                </text>
                <text
                  x={lx}
                  y={ly + 11}
                  textAnchor="middle"
                  className="radar-value"
                >
                  {values[i] ?? "—"}
                </text>
              </g>
            );
          })}
          {full && (
            <polygon
              points={polygon(axes.map(() => 50))}
              fill="#cbd5e1"
              fillOpacity=".2"
              stroke="#cbd5e1"
            />
          )}
          {otherFull && (
            <polygon
              data-series="comparison"
              points={polygon(other)}
              fill="#4b91f7"
              fillOpacity=".14"
              stroke="#4b91f7"
              strokeWidth="2"
            />
          )}
          {full && (
            <polygon
              data-series="primary"
              points={polygon(values)}
              fill="#1dc779"
              fillOpacity=".23"
              stroke="#1dc779"
              strokeWidth="2"
            />
          )}
          {full &&
            values.map((v, i) => {
              const [x, y] = point(i, v!);
              return (
                <circle key={i} cx={x} cy={y} r="3.5" fill="#1dc779">
                  <title>{`${labels[axes[i]][ru ? 0 : 1]}: ${v}`}</title>
                </circle>
              );
            })}
        </svg>
      ) : (
        <div className="radar-empty">
          {ru
            ? "Для кругового радара нужны минимум 3 показателя."
            : "Doiraviy radar uchun kamida 3 ko‘rsatkich kerak."}
          {axes.map((key, i) => (
            <p key={key}>
              {labels[key][ru ? 0 : 1]} <strong>{values[i] ?? "—"}</strong>
            </p>
          ))}
        </div>
      )}
      <div className="comparison-key">
        <span>
          <i />
          {player.name[lang]}
        </span>
        {comparison && (
          <span>
            <i />
            {comparison.name[lang]}
          </span>
        )}
        {full && (
          <span className="mean-key">
            <i />
            {ru ? "P50 группы" : "Guruh P50"}
          </span>
        )}
      </div>
      {series.missing.length > 0 && (
        <p className="compact-warning">
          {ru ? "Нет данных: " : "Ma’lumot yo‘q: "}
          {series.missing
            .map((key) => labels[key][ru ? 0 : 1])
            .join(", ")}.{" "}
          {ru
            ? "Показаны доступные метрики."
            : "Mavjud ko‘rsatkichlar ko‘rsatilgan."}
        </p>
      )}
      {comparison && !otherFull && (
        <p className="compact-warning">
          {ru
            ? "Недостаточно общих метрик одного периода для второго контура."
            : "Ikkinchi kontur uchun bir davrdagi umumiy ko‘rsatkichlar yetarli emas."}
        </p>
      )}
      <details className="explanation">
        <summary>
          {ru ? "Как читать радар" : "Radarni qanday o‘qish kerak"}
        </summary>
        <p>
          {ru
            ? "P80 означает, что показатель выше примерно 80% игроков группы. P50 — середина распределения, а не среднее значение метрики. База сравнения: минимум 450 покрытых минут и 80% покрытия; для игрока — 90 минут и 60%. Процентиль не является общей оценкой игрока."
            : "P80 — ko‘rsatkich guruh futbolchilarining taxminan 80% idan yuqori. P50 — taqsimot o‘rtasi, ko‘rsatkichning arifmetik o‘rtachasi emas. Baza: kamida 450 qamrab olingan daqiqa va 80% qamrov; futbolchi uchun 90 daqiqa va 60%. Percentil umumiy sifat bahosi emas."}
        </p>
      </details>
    </section>
  );
}
export function HeadToHead({
  player,
  comparison,
  lang,
}: {
  player: Player;
  comparison: Player;
  lang: Language;
}) {
  const ru = lang === "ru";
  const rows = [
    ...keys[player.position],
    ...(player.position === "GK" ? [] : ["duelWinPct"]),
  ];
  const value = (p: Player, key: string) => p.roleMetrics?.[key] ?? null;
  return (
    <section className="analysis-card head-to-head">
      <h3>{ru ? "Сравнение показателей" : "Ko‘rsatkichlar taqqoslovi"}</h3>
      <p className="muted">
        {ru
          ? "За 90 минут · доли успешных действий в %"
          : "90 daqiqada · muvaffaqiyat ulushi % da"}
      </p>
      <div className="comparison-key">
        <span>
          <i />
          {player.name[lang]}
        </span>
        <span>
          <i />
          {comparison.name[lang]}
        </span>
      </div>
      <div className="head-to-head-rows">
        {rows.map((key) => {
          const a = value(player, key),
            b = value(comparison, key),
            pct = key.endsWith("Pct"),
            max = pct ? 100 : Math.max(1, a ?? 0, b ?? 0);
          const label =
            key === "duelWinPct"
              ? ru
                ? "Единоборства, %"
                : "Kurashlar, %"
              : labels[key]?.[ru ? 0 : 1] || key;
          return (
            <div className="head-to-head-row" key={key} data-metric={key}>
              <b>{fmt(a, pct)}</b>
              <div
                className="versus-track primary"
                role="img"
                aria-label={`${player.name[lang]}: ${fmt(a, pct)}`}
              >
                {a !== null && <i style={{ width: `${(a / max) * 100}%` }} />}
              </div>
              <span>{label}</span>
              <div
                className="versus-track other"
                role="img"
                aria-label={`${comparison.name[lang]}: ${fmt(b, pct)}`}
              >
                {b !== null && <i style={{ width: `${(b / max) * 100}%` }} />}
              </div>
              <b>{fmt(b, pct)}</b>
            </div>
          );
        })}
      </div>
      <p className="muted">
        {ru
          ? "Обе полосы каждой метрики имеют общую шкалу. Прочерк — нет данных."
          : "Har bir ko‘rsatkichning ikki chizig‘i bir shkalada. Tire — ma’lumot yo‘q."}
      </p>
    </section>
  );
}

export function PercentileBars({
  player,
  lang,
}: {
  player: Player;
  lang: Language;
}) {
  const { axes } = radarSeries(player);
  return (
    <section className="analysis-card percentile-bars">
      <h3>{lang === "ru" ? "Игровой профиль" : "O‘yin profili"}</h3>
      <p className="muted">
        {lang === "ru"
          ? "Процентили среди игроков той же позиции"
          : "Bir pozitsiyadagi futbolchilar orasidagi percentillar"}
      </p>
      {axes.map((a) => (
        <div className="style-row" key={a.key}>
          <span>{labels[a.key][lang === "ru" ? 0 : 1]}</span>
          <div>
            <i style={{ width: `${a.value}%` }} />
          </div>
          <b>{a.value}</b>
        </div>
      ))}
    </section>
  );
}
