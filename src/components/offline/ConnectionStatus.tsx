"use client";
import { useEffect, useState } from "react";
export function ConnectionStatus({ groupCode }: { groupCode?: string }) {
  const [sourceUpdated, setSourceUpdated] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [updated, setUpdated] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.appReady = "true";
    const readSource = () =>
      setSourceUpdated(
        document
          .querySelector("[data-schedule-updated]")
          ?.getAttribute("data-schedule-updated") || null,
      );
    readSource();
    const observer = new MutationObserver(readSource);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-schedule-updated"],
    });
    const offlineClick = (e: MouseEvent) => {
      if (navigator.onLine) return;
      const a = (e.target as Element)?.closest?.("a");
      if (!a) return;
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname.startsWith("/browse/")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        location.assign(u.href);
      }
    };
    document.addEventListener("click", offlineClick, true);
    const update = () => {
      setOnline(navigator.onLine);
      document.documentElement.dataset.offline = String(!navigator.onLine);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((r) => {
          r.active?.postMessage({ type: "STATUS" });
          if (groupCode)
            for (const suffix of ["", "/deadlines"])
              r.active?.postMessage({
                type: "SAVE_PUBLIC",
                path: "/browse/" + groupCode.replace("/", "-") + suffix,
              });
        })
        .catch(() => {});
    const message = (e: MessageEvent) => {
      if (e.data?.type === "CACHE_STATUS") setUpdated(e.data.updated);
    };
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", offlineClick, true);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, [groupCode]);
  return (
    <div className="relative">
      <button
        className="connection-button"
        aria-label="Состояние подключения"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M3 8q9-7 18 0M6 12q6-5 12 0M9 16q3-2 6 0" />
          <circle cx="12" cy="20" r="1" />
          {!online && <path d="M3 3l18 18" />}
        </svg>
      </button>
      {open && (
        <div className="connection-detail" role="status">
          {online ? "Есть подключение" : "Нет сети · сохранённая копия"}
          {sourceUpdated && (
            <p>
              Данные РУЗ:{" "}
              {new Date(sourceUpdated).toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
              })}{" "}
              МСК
            </p>
          )}
          <br />
          {updated
            ? `Копия на устройстве: ${new Date(updated).toLocaleString("ru-RU")}`
            : "Сохранённой копии пока нет"}
          <br />
          <a href="/offline.html">Открыть сохранённое расписание →</a>
          <p>
            Без сети доступны ранее открытые общие страницы групп. Личные данные
            и вход не кэшируются.
          </p>
        </div>
      )}
    </div>
  );
}
