import Link from 'next/link';
import { loadMvpPlayers } from '@/lib/mvp-data';
import { DataNote, PlayerCards, PlayerIdentity } from '@/components/mvp/common';
import { groupTeams } from '@/lib/mvp';
import { ArrowUpRight } from 'lucide-react';

export default async function HomePage() {
  const players = await loadMvpPlayers();
  const teams = groupTeams(players);
  return <><section className="home-hero"><div className="hero-copy"><span className="eyebrow">UZSTAT · СКАУТИНГ В УЗБЕКИСТАНЕ</span>
    <h1>Футбольные данные<br />для <em>точных решений</em></h1><p>Изучайте игроков, сравнивайте показатели и находите усиление для вашей команды.</p>
    <div className="actions"><Link className="button" href="/players">Найти игрока <ArrowUpRight size={16} /></Link><Link className="button secondary" href="/compare">Сравнить игроков</Link></div>
    </div><div className="hero-snapshot"><span className="eyebrow">В ВАШЕЙ ВЫБОРКЕ</span><div className="snapshot-counts"><div><strong>{players.length}</strong><span>Игроков</span></div><div><strong>{teams.length}</strong><span>Клубов</span></div><div><strong>2025</strong><span>Сезон данных</span></div></div>
      {players[0] && <Link className="snapshot-player" href={`/players/${players[0].id}`}><PlayerIdentity player={players[0]} /><ArrowUpRight size={18} /></Link>}
      <p className="fine-print">Сохранённые матчи Суперлиги. Покрытие сезона частичное.</p></div></section>
    <div className="home-actions">
      <Link href="/players"><span>01</span><h2>Найти игрока</h2><p>Посмотреть игроков и их показатели.</p><b aria-hidden="true">→</b></Link>
      <Link href="/recruitment"><span>02</span><h2>Подобрать усиление</h2><p>Выбрать кандидатов под вашу потребность.</p><b aria-hidden="true">→</b></Link>
      <Link href="/teams"><span>03</span><h2>Открыть команды</h2><p>Посмотреть клубы и перейти к подбору.</p><b aria-hidden="true">→</b></Link>
    </div>
    <div className="section-heading"><h2>Игроки в выборке</h2><Link href="/players">Все игроки →</Link></div>
    <PlayerCards players={players} /><DataNote />
  </>;
}
