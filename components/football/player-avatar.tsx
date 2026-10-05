"use client";
import React, { useEffect, useState } from "react";
import type { Player, Language } from "@/types/players";
export function PlayerAvatar({
  player,
  lang,
  large = false,
}: {
  player: Player;
  lang: Language;
  large?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [player.photoUrl]);
  const urls = [
    player.photoUrl,
    player.photoUrl?.replace("img.sofascore.com", "api.sofascore.com"),
  ];
  return (
    <div className={`player-avatar ${large ? "large" : ""}`}>
      {attempt >= urls.length || !player.photoUrl ? (
        player.initials
      ) : (
        <img
          src={urls[attempt]}
          alt={player.name[lang]}
          onError={() => setAttempt((n) => n + 1)}
        />
      )}
    </div>
  );
}
