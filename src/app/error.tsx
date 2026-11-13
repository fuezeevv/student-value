"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="max-w-md mx-auto py-12">
      <h1 className="page-title">Не удалось загрузить страницу</h1>
      <p className="page-intro">
        Попробуйте подключиться ещё раз или откройте сохранённое общее
        расписание.
      </p>
      <button className="action-primary" onClick={reset}>
        Повторить
      </button>
      <a className="text-link block mt-6" href="/offline.html">
        Расписание на устройстве →
      </a>
    </section>
  );
}
