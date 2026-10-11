'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MVP_STORAGE_KEY, parseShortlist } from '@/lib/mvp';
import { ArrowLeftRight, Bookmark, Home, Search, SlidersHorizontal, Users, Shield } from 'lucide-react';

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
  const navigation = [['/', 'Главная', Home], ['/players', 'Игроки', Users], ['/teams', 'Команды', Shield], ['/recruitment', 'Подбор игрока', SlidersHorizontal], ['/compare', 'Сравнение', ArrowLeftRight], ['/shortlist', 'Избранное', Bookmark]] as const;
  return <ShortlistContext.Provider value={{ ids, ready, error, toggle }}>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand" aria-label="Uzstat — главная"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Uzstat</Link>
      <form action="/players" className="global-search" role="search"><Search size={18} aria-hidden="true" /><input name="q" type="search" placeholder="Поиск игрока…" aria-label="Быстрый поиск игрока" /></form>
      <div className="topbar-context"><span>Узбекистан</span><b>2025</b><span className="topbar-divider" /><span className="topbar-status"><i />Скаутинг</span></div>
    </div></header>
    <aside className="sidebar"><nav aria-label="Основная навигация">{navigation.map(([href, title, Icon]) => <Link key={href} href={href}
      aria-current={pathname === href || (href !== '/' && pathname.startsWith(href + '/')) ? 'page' : undefined}><Icon size={18} aria-hidden="true" />{title}</Link>)}</nav>
      <div className="sidebar-note"><span>ВЫБОРКА MVP</span><strong>10 игроков</strong><p>Подтверждённая статистика сохранённых матчей.</p><Link href="/players">Посмотреть игроков →</Link></div>
    </aside>
    <div className={`page-area ${pathname === '/players' ? 'players-page-area' : ''}`}><main className="workspace">{error && <p role="alert" className="notice">{error}</p>}{children}</main>
      <footer className="site-footer">Uzstat · Скаутинг по подтверждённым данным<span>Сезон 2025 · Неполное покрытие</span></footer>
    </div>
  </ShortlistContext.Provider>;
}

export function SaveButton({ id }: { id: string }) {
  const { ids, ready, toggle } = useShortlist();
  const saved = ids.includes(id);
  return <button className="button secondary" disabled={!ready} aria-pressed={saved} onClick={() => toggle(id)}>
    {saved ? 'Удалить из избранного' : 'Добавить в избранное'}
  </button>;
}
