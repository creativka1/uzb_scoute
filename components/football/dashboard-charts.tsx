"use client";
import React from "react";
export interface PlotRow {
  label: string;
  values: (number | null)[];
}
const colors = ["#19be76", "#4789ed", "#ef6878"];
export function LinePlot({
  rows,
  series,
  title,
}: {
  rows: PlotRow[];
  series: string[];
  title: string;
}) {
  const max = Math.max(
      1,
      ...rows.flatMap((r) =>
        r.values.filter((v): v is number => v !== null && Number.isFinite(v)),
      ),
    ),
    x = (i: number) => 38 + (i * 580) / Math.max(1, rows.length - 1),
    y = (v: number) => 170 - (v / max) * 140;
  return (
    <figure className="dashboard-plot">
      <figcaption>{title}</figcaption>
      {!rows.length ? (
        <p className="empty-inline">—</p>
      ) : (
        <svg
          preserveAspectRatio="none"
          viewBox="0 0 650 212"
          role="img"
          aria-label={title}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line
                x1="38"
                x2="618"
                y1={y(max * f)}
                y2={y(max * f)}
                stroke="#e7edf3"
              />
              <text x="28" y={y(max * f) + 4} textAnchor="end">
                {(max * f).toFixed(max < 5 ? 1 : 0)}
              </text>
            </g>
          ))}
          {series.map((s, j) => (
            <g key={s}>
              {rows.map((r, i) => {
                const v = r.values[j],
                  prev = rows[i - 1]?.values[j];
                return typeof v === "number" && Number.isFinite(v) ? (
                  <g key={i}>
                    {i > 0 &&
                      typeof prev === "number" &&
                      Number.isFinite(prev) && (
                        <line
                          x1={x(i - 1)}
                          x2={x(i)}
                          y1={y(prev)}
                          y2={y(v)}
                          stroke={colors[j % 3]}
                          strokeWidth="2.5"
                        />
                      )}
                    <circle cx={x(i)} cy={y(v)} r="3" fill={colors[j % 3]}>
                      <title>{`${r.label} · ${s}: ${v}`}</title>
                    </circle>
                  </g>
                ) : null;
              })}
            </g>
          ))}
          {rows.map(
            (r, i) =>
              (i === 0 ||
                i === rows.length - 1 ||
                (i % Math.max(1, Math.ceil(rows.length / 5)) === 0 &&
                  rows.length - 1 - i >= Math.ceil(rows.length / 7))) && (
                <text
                  key={i}
                  x={x(i)}
                  y="199"
                  textAnchor={
                    i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"
                  }
                >
                  {r.label}
                </text>
              ),
          )}
        </svg>
      )}
      <div className="plot-legend">
        {series.map((s, i) => (
          <span key={s}>
            <i style={{ background: colors[i % 3] }} />
            {s}
          </span>
        ))}
      </div>
    </figure>
  );
}
export function MiniBars({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="mini-bars">
      {rows.map((r, i) => (
        <div key={r.label}>
          <span>{r.label}</span>
          <div>
            <i
              style={{
                width: `${(r.value / max) * 100}%`,
                background: colors[i % 3],
              }}
            />
          </div>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}
export function SquadDonut({
  rows,
  totalLabel,
}: {
  rows: { label: string; value: number }[];
  totalLabel: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  let offset = 0;
  return (
    <div className="squad-donut">
      <svg viewBox="0 0 170 170" role="img" aria-label={totalLabel}>
        <circle
          cx="85"
          cy="85"
          r="59"
          fill="none"
          stroke="#edf1f5"
          strokeWidth="20"
        />
        {rows.map((r, i) => {
          const length = total ? (r.value / total) * 370.71 : 0,
            start = offset;
          offset += length;
          return (
            <circle
              key={r.label}
              cx="85"
              cy="85"
              r="59"
              fill="none"
              stroke={["#19be76", "#4789ed", "#f8c950", "#8695aa"][i % 4]}
              strokeWidth="20"
              strokeDasharray={`${length} ${370.71 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 85 85)"
            />
          );
        })}
        <text x="85" y="85" textAnchor="middle" className="donut-number">
          {total}
        </text>
        <text x="85" y="106" textAnchor="middle">
          {totalLabel}
        </text>
      </svg>
      <div>
        {rows.map((r, i) => (
          <p key={r.label}>
            <i
              style={{
                background: ["#19be76", "#4789ed", "#f8c950", "#8695aa"][i % 4],
              }}
            />
            {r.label}
            <b>{r.value}</b>
          </p>
        ))}
      </div>
    </div>
  );
}
