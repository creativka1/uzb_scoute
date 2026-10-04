"use client";
import { useEffect, useState } from "react";
import type { League } from "@/types/players";
import type { MatchCore } from "@/types/matches";
export function useMatchCore(league: League) {
  const [data, setData] = useState<MatchCore | null>(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    let active = true;
    setData(null);
    setError(false);
    const timer = setTimeout(() => {
      if (active) {
        c.abort();
        setError(true);
      }
    }, 15000);
    fetch(`/api/analysis?league=${league}`, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error("load");
        return r.json();
      })
      .then((v) => {
        if (active) setData(v);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      c.abort();
    };
  }, [league, revision]);
  return { data, error, refresh: () => setRevision((v) => v + 1) };
}
