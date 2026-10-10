'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Player } from '@/types/players';
import { formatNumber } from '@/lib/mvp';
import { PageHeading, PlayerIdentity } from './common';
import { SaveButton, useShortlist } from './shell';

export function Shortlist({ players }: { players: Player[] }) {
  const { ids, ready, error } = useShortlist();
  const [selected, setSelected] = useState<string[]>([]);
  const saved = players.filter(player => ids.includes(player.id));
  const pair = selected.filter(id => ids.includes(id));
  const archived = ids.filter(id => !players.some(player => player.id === id)).length;
  return <><PageHeading title="Избранное" description="Ваш короткий список игроков. Сохраняется в этом браузере без регистрации." />
    {!ready && !error && <p role="status">Загрузка сохранённого списка…</p>}
    {archived > 0 && <p className="data-note">В старом списке ещё {archived} игроков вне MVP. Их записи сохранены, но здесь показаны только наши 10 игроков.</p>}
    {ready && !saved.length && <div className="empty"><h2>Пока нет выбранных игроков</h2><p>Добавьте игрока из его профиля.</p><Link className="button" href="/players">Открыть игроков</Link></div>}
    {saved.length > 0 && <><div className="section-heading"><p>Выберите двух игроков для сравнения.</p>
      {pair.length === 2 ? <Link className="button" href={`/compare?a=${pair[0]}&b=${pair[1]}`}>Сравнить выбранных</Link> : <button className="button" disabled>Сравнить выбранных ({pair.length}/2)</button>}
    </div><div className="saved-list">{saved.map(player => <article key={player.id} className="saved-row">
      <label className="compare-check"><input type="checkbox" aria-label={`Сравнить ${player.name.ru}`} checked={pair.includes(player.id)} disabled={!pair.includes(player.id) && pair.length === 2}
        onChange={() => setSelected(pair.includes(player.id) ? pair.filter(id => id !== player.id) : [...pair, player.id])} /></label>
      <Link href={`/players/${player.id}`}><PlayerIdentity player={player} /></Link>
      <span className="saved-score">Scout Index <strong>{formatNumber(player.scoutIndex)}</strong></span><SaveButton id={player.id} />
    </article>)}</div></>}
  </>;
}
