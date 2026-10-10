'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="empty" role="alert"><h1>Не удалось загрузить данные</h1><p>Сохранённый набор игроков временно недоступен. Попробуйте ещё раз.</p><button className="button" onClick={reset}>Повторить</button></div>;
}
