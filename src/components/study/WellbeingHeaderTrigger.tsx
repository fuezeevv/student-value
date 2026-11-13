"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  buildDailyPlan,
  planningLabels,
  type DailyTask,
} from "@/lib/study/daily-plan";
export type { DailyTask } from "@/lib/study/daily-plan";
type Day = { seconds: number; steps: string[]; goal?: number };
type RecordData = {
  days: Record<string, Day>;
  running: number | null;
  goal: number;
  starts: Record<string, number>;
};
const dayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function WellbeingHeaderTrigger({
  userId,
  tasks,
}: {
  userId: string;
  tasks: DailyTask[];
}) {
  const [open, setOpen] = useState(false),
    [ready, setReady] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [data, setData] = useState<RecordData>({
      days: {},
      running: null,
      goal: 45,
      starts: {},
    });
  const key = "sv-focus-v1:" + userId,
    today = dayKey();
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        saved &&
        saved.days &&
        typeof saved.days === "object" &&
        [25, 45, 60, 90, 120, 180, 240].includes(saved.goal)
      )
        setData({
          goal: saved.goal,
          starts:
            saved.starts && typeof saved.starts === "object"
              ? (Object.fromEntries(
                  Object.entries(saved.starts)
                    .filter(
                      ([k, v]) =>
                        k.length < 250 &&
                        typeof v === "number" &&
                        Number.isFinite(v) &&
                        v > 0 &&
                        v <= Date.now(),
                    )
                    .slice(-1000),
                ) as Record<string, number>)
              : {},
          running:
            typeof saved.running === "number" &&
            Number.isFinite(saved.running) &&
            saved.running > 0 &&
            saved.running <= Date.now()
              ? saved.running
              : null,
          days: Object.fromEntries(
            Object.entries(saved.days)
              .filter(
                ([k, v]) =>
                  /^\d{4}-\d{2}-\d{2}$/.test(k) &&
                  !!v &&
                  typeof v === "object" &&
                  typeof (v as Day).seconds === "number" &&
                  Number.isFinite((v as Day).seconds) &&
                  Array.isArray((v as Day).steps),
              )
              .slice(-90)
              .map(([k, v]) => [
                k,
                {
                  seconds: Math.max(0, Math.min(86400, (v as Day).seconds)),
                  goal:
                    typeof (v as Day).goal === "number"
                      ? (v as Day).goal
                      : saved.goal,
                  steps: (v as Day).steps
                    .filter((x) => typeof x === "string")
                    .slice(0, 500),
                },
              ]),
          ),
        });
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const missing = tasks.filter((t) => data.starts[t.id] === undefined);
    if (missing.length)
      setData((v) => ({
        ...v,
        starts: {
          ...v.starts,
          ...Object.fromEntries(
            missing.map((t) => [t.id, Date.parse(today + "T00:00:00+03:00")]),
          ),
        },
      }));
  }, [tasks, data.starts, ready, today]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {}
  }, [data, key, ready]);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!data.running) return;
    const started = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(data.running));
    if (started !== today)
      setData((v) => {
        if (!v.running) return v;
        const old = v.days[started] || { seconds: 0, steps: [] };
        const elapsed = Math.max(
          0,
          Math.floor(
            (Date.parse(today + "T00:00:00+03:00") - v.running) / 1000,
          ),
        );
        return {
          ...v,
          running: null,
          days: {
            ...v.days,
            [started]: {
              ...old,
              goal: v.goal,
              seconds: Math.min(v.goal * 60, old.seconds + elapsed),
            },
          },
        };
      });
  }, [data.running, today]);
  const day = useMemo(
    () => data.days[today] || { seconds: 0, steps: [] },
    [data.days, today],
  );
  // Timer time is personal study time, never proof of completing or passing a task.
  const live =
    data.running &&
    dayKey() ===
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(data.running))
      ? Math.min(
          Math.max(0, data.goal * 60 - day.seconds),
          Math.max(0, Math.floor((tick - data.running) / 1000)),
        )
      : 0;
  const seconds = day.seconds + live,
    percent = Math.min(100, Math.floor((seconds / (data.goal * 60)) * 100));
  const previousSteps = Object.entries(data.days)
    .filter(([k]) => k < today)
    .flatMap(([, d]) => d.steps);
  const plan = buildDailyPlan(
    tasks,
    previousSteps,
    new Date(today + "T00:00:00+03:00").getTime(),
    data.starts,
  );
  const updateDay = (next: Day) =>
    setData((v) => ({
      ...v,
      days: { ...v.days, [today]: { ...next, goal: data.goal } },
    }));
  const stop = useCallback(
    () =>
      setData((v) => ({
        ...v,
        running: null,
        days: { ...v.days, [today]: { ...day, seconds, goal: data.goal } },
      })),
    [day, seconds, today, data.goal],
  );
  useEffect(() => {
    if (data.running && seconds >= data.goal * 60) stop();
  }, [seconds, data.running, data.goal, stop]);
  return (
    <>
      <button
        className="connection-button"
        aria-label="Дневной план и таймер"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="28" height="28" viewBox="0 0 32 32">
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke={percent >= 100 ? "#2d9979" : "#609cc9"}
            strokeWidth="3"
            strokeDasharray={`${percent * 0.754} 75.4`}
            transform="rotate(-90 16 16)"
          />
          <text
            x="16"
            y="20"
            textAnchor="middle"
            fontSize="10"
            fill="currentColor"
          >
            {percent}
          </text>
        </svg>
      </button>
      {open &&
        ready &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <section
              className="daily-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Дневной план"
            >
              <header className="flex justify-between items-center">
                <h2>Сегодня в своём темпе</h2>
                <button aria-label="Закрыть" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </header>
              <p>
                Личный ориентир, не условие допуска к сессии. Время и шаги
                сохраняются только на этом устройстве.
              </p>
              <div className="daily-week">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(Date.now() - (6 - i) * 86400000),
                    k = new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Europe/Moscow",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(d),
                    v = data.days[k];
                  return (
                    <div key={k} title={k}>
                      <span>
                        {d.toLocaleDateString("ru-RU", {
                          weekday: "narrow",
                          timeZone: "Europe/Moscow",
                        })}
                      </span>
                      <span
                        style={{
                          background:
                            v?.seconds >= (v?.goal || data.goal) * 60
                              ? "#2d9979"
                              : v?.seconds
                                ? "#609cc9"
                                : v && k < today
                                  ? "var(--wine)"
                                  : "var(--border)",
                        }}
                      >
                        {d.toLocaleDateString("ru-RU", {
                          day: "numeric",
                          timeZone: "Europe/Moscow",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <h3>
                {Math.floor(seconds / 60)} из {data.goal} минут · {percent}%
              </h3>
              <label>
                Цель по времени{" "}
                <select
                  value={data.goal}
                  disabled={!!data.running}
                  onChange={(e) =>
                    setData((v) => ({ ...v, goal: Number(e.target.value) }))
                  }
                >
                  {[25, 45, 60, 90, 120, 180, 240].map((n) => (
                    <option key={n} value={n}>
                      {n} минут
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="daily-start"
                onClick={() =>
                  data.running
                    ? stop()
                    : setData((v) => ({ ...v, running: Date.now() }))
                }
              >
                {data.running ? "Пауза" : "Начать заниматься"}
              </button>
              <h3>Небольшие шаги на сегодня</h3>
              <p>
                Для каждого предмета: оставшиеся части работ делятся на дни до
                ближайшего известного срока. Без будущей даты используется
                горизонт планирования 14 дней — это рекомендация приложения, не
                срок преподавателя. Лабораторная разбита на три равные части для
                планирования. Содержание каждой части уточняйте по заданию.
              </p>
              {plan.length ? (
                plan.map(({ task: t, stage: n, id, estimated, horizon }) => {
                  const stages = planningLabels(t);
                  return (
                    <label className="daily-step" key={id}>
                      <input
                        type="checkbox"
                        checked={day.steps.includes(id)}
                        onChange={(e) =>
                          updateDay({
                            ...day,
                            steps: e.target.checked
                              ? [...day.steps, id]
                              : day.steps.filter((s) => s !== id),
                          })
                        }
                      />
                      <span>
                        {t.course} · {t.title}
                        <small>
                          {stages[n]}·{" "}
                          {estimated
                            ? "план на 14 дней"
                            : `до срока ${horizon} дн.`}
                        </small>
                        <a href={"/tasks/" + t.id}>Открыть задание →</a>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p>
                  Незавершённых опубликованных работ нет. Это не подтверждает
                  отсутствие других заданий на занятиях.
                </p>
              )}
              <p>
                Отметка шага и таймер не меняют выполнение задания, XP или зачёт
                преподавателя. Необязательные домашние задания ОТУ в этот план
                не включены.
              </p>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
