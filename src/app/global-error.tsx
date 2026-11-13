"use client";
export default function GlobalError() {
  return (
    <html lang="ru">
      <body
        style={{
          fontFamily: "system-ui",
          background: "#0b1a2d",
          color: "#e6eef8",
          padding: 32,
        }}
      >
        <h1>Student Value</h1>
        <p>
          Сервис временно недоступен. Сохранённое общее расписание может быть
          доступно без подключения.
        </p>
        <button onClick={() => location.reload()}>Повторить</button>
        <p>
          <a style={{ color: "#9ed9ed" }} href="/offline.html">
            Открыть сохранённое расписание
          </a>
        </p>
      </body>
    </html>
  );
}
