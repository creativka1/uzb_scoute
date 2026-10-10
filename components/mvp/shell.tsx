'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MVP_STORAGE_KEY, parseShortlist } from '@/lib/mvp';

type ShortlistState = { ids: string[]; ready: boolean; error: string; toggle: (id: string) => void };
const ShortlistContext = createContext<ShortlistState>({ ids: [], ready: false, error: '', toggle() {} });
export const useShortlist = () => useContext(ShortlistContext);

export function MvpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const read = () => {
      try {
        let raw = localStorage.getItem(MVP_STORAGE_KEY);
        if (raw === null) {
          // Migrate identifiers only; keep the old saved list untouched.
          const old = localStorage.getItem('uzstat.shortlist.v1');
          if (old !== null) {
            const list: unknown = JSON.parse(old);
            if (!Array.isArray(list) || list.some(p => typeof p?.id !== 'string')) throw new Error('Invalid legacy shortlist');
            raw = JSON.stringify(list.map(p => p.id));
          }
        }
        setIds(parseShortlist(raw)); setReady(true); setError('');
      } catch {
        setReady(false); setError('Не удалось прочитать сохранённый список. Данные в браузере сохранены без изменений.');
      }
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  const toggle = useCallback((id: string) => {
    if (!ready) return;
    try {
      const raw = localStorage.getItem(MVP_STORAGE_KEY);
      const current = raw === null ? ids : parseShortlist(raw);
      const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
      localStorage.setItem(MVP_STORAGE_KEY, JSON.stringify(next));
      setIds(next); setError('');
    } catch { setError('Не удалось сохранить список в браузере. Попробуйте ещё раз.'); }
  }, [ids, ready]);
  const navigation = [['/', 'Главная'], ['/players', 'Игроки'], ['/teams', 'Команды'], ['/recruitment', 'Подбор игрока'], ['/shortlist', 'Избранное']] as const;
  return <ShortlistContext.Provider value={{ ids, ready, error, toggle }}>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand" aria-label="Uzstat — главная">Uzstat<span>Футбольный скаутинг</span></Link>
      <nav aria-label="Основная навигация">{navigation.map(([href, title]) => <Link key={href} href={href}
        aria-current={pathname === href || (href !== '/' && pathname.startsWith(href + '/')) ? 'page' : undefined}>{title}</Link>)}</nav>
    </div></header>
    <main className="workspace">{error && <p role="alert" className="notice">{error}</p>}{children}</main>
    <footer className="site-footer">Uzstat · 10 игроков · Подтверждённые матчи 2025 года</footer>
  </ShortlistContext.Provider>;
}

export function SaveButton({ id }: { id: string }) {
  const { ids, ready, toggle } = useShortlist();
  const saved = ids.includes(id);
  return <button className="button secondary" disabled={!ready} aria-pressed={saved} onClick={() => toggle(id)}>
    {saved ? 'Удалить из избранного' : 'Добавить в избранное'}
  </button>;
}
