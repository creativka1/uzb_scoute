import Link from 'next/link';

export default function NotFound() {
  return <div className="empty"><h1>Страница не найдена</h1><p>Этот игрок или команда не входят в выборку MVP.</p><Link className="button" href="/players">Открыть игроков</Link></div>;
}
