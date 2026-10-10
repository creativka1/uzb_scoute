import Link from 'next/link';
import { loadMvpPlayers } from '@/lib/mvp-data';
import { DataNote, PageHeading, PlayerCards } from '@/components/mvp/common';

export default async function HomePage() {
  const players = await loadMvpPlayers();
  return <><PageHeading title="Uzstat" description="Аналитическая платформа для поиска и сравнения футболистов." />
    <div className="home-actions">
      <Link href="/players"><span>01</span><h2>Найти игрока</h2><p>Посмотреть игроков и их показатели.</p><b aria-hidden="true">→</b></Link>
      <Link href="/recruitment"><span>02</span><h2>Подобрать усиление</h2><p>Выбрать кандидатов под вашу потребность.</p><b aria-hidden="true">→</b></Link>
      <Link href="/teams"><span>03</span><h2>Открыть команды</h2><p>Посмотреть клубы и перейти к подбору.</p><b aria-hidden="true">→</b></Link>
    </div>
    <div className="section-heading"><h2>10 игроков MVP</h2><Link href="/players">Открыть список →</Link></div>
    <PlayerCards players={players} /><DataNote />
  </>;
}
