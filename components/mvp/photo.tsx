'use client';

import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { Player } from '@/types/players';
import photos from '@/public/players/sofascore/manifest.json';

export function PlayerPhoto({ player }: { player: Player }) {
  const id = player.id.split('-')[1];
  const cached = (photos as Record<string, { file: string }>)[id];
  const source = cached?.file || player.photoUrl;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached or failed request can finish before React attaches onError.
    const image = imageRef.current;
    if (source && image?.complete && image.naturalWidth === 0) setFailedSource(source);
  }, [source]);
  const available = source && failedSource !== source;
  return <span className="avatar" aria-label={`${available ? 'Фото' : 'Фото недоступно:'} ${player.name.ru}`}>
    {available
      ? <img ref={imageRef} src={source} alt={player.name.ru} loading="lazy" decoding="async" onError={() => setFailedSource(source)} />
      : <span className="avatar-placeholder"><UserRound size={24} aria-hidden="true" /><span>{player.initials}</span></span>}
  </span>;
}
