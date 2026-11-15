"use client";

import { useRef } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { scheduleFlow } from "@/lib/schedule/flow";
import {
  lessonActivity,
  lessonType,
  teachingRoom,
} from "@/lib/schedule/presentation";
import type { WorkbenchDay } from "./ScheduleWorkbench";

export function ScheduleFlow({
  days,
  date,
  time,
  group,
  state,
  fetchedAt,
  openSchedule,
}: {
  days: WorkbenchDay[];
  date: string;
  time: string;
  group: string;
  state: string;
  fetchedAt?: Date | string | null;
  openSchedule: () => void;
}) {
  const { focus, current, following } = scheduleFlow(days, date, time);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const formatDate = (value: string) =>
    formatInTimeZone(
      new Date(value + "T12:00:00+03:00"),
      "Europe/Moscow",
      "EEEE, d MMMM",
      { locale: ru },
    );
  return (
    <section
      className="schedule-flow"
      aria-label="Поток расписания"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        gesture.current =
          event.touches.length === 1
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      }}
      onTouchEnd={(event) => {
        const start = gesture.current;
        gesture.current = null;
        const end = event.changedTouches[0];
        if (
          start &&
          end &&
          start.y - end.clientY > 64 &&
          Math.abs(start.x - end.clientX) < 60
        )
          openSchedule();
      }}
    >
      <p className="flow-group">{group}</p>
      {state === "STALE" && (
        <p className="flow-source" role="status">
          Часть расписания не обновилась. Показаны последние доступные данные.
        </p>
      )}
      {state === "UNAVAILABLE" || state === "UNCONFIGURED" ? (
        <div className="flow-focus">
          <p className="flow-date">Расписание пока недоступно</p>
          <h2>Проверим позже</h2>
          <p>Это не означает, что занятий нет.</p>
        </div>
      ) : focus ? (
        <div className="flow-focus">
          <p className="flow-date">{formatDate(focus.date)}</p>
          <p className="flow-time">{focus.lesson.start}</p>
          <h2>{focus.lesson.subject}</h2>
          <p className="flow-format">{lessonType(focus.lesson.type)}</p>
          <p className="flow-room">
            {focus.lesson.rooms.map(teachingRoom).join(" / ") ||
              "Аудитория не указана"}
          </p>
          <p className="flow-teacher">{focus.lesson.teachers.join(", ")}</p>
          {focus.lesson.note && (
            <p className="flow-teacher">{focus.lesson.note}</p>
          )}
          {focus.lesson.courseHref && (
            <Link className="flow-course" href={focus.lesson.courseHref}>
              Открыть предмет ↗
            </Link>
          )}
        </div>
      ) : (
        <div className="flow-focus">
          <p className="flow-date">{formatDate(date)}</p>
          <h2>Нет предстоящих пар</h2>
          <p>
            В загруженном периоде пар больше нет. Работы и сроки остаются в
            разделе «Сроки».
          </p>
        </div>
      )}
      {current && (
        <div className="flow-current">
          <p>{current.lesson.subject}</p>
          <div
            role="progressbar"
            aria-label="Прогресс пары"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              lessonActivity(current.lesson.start, time).progress,
            )}
          >
            <span
              style={{
                width: `${lessonActivity(current.lesson.start, time).progress}%`,
              }}
            />
          </div>
        </div>
      )}
      {following.length > 0 && (
        <div className="flow-stack" aria-label="Следующие пары">
          {following.slice(0, 2).map(({ date: eventDate, lesson }, index) => (
            <button
              type="button"
              key={`${eventDate}-${lesson.start}-${index}`}
              onClick={openSchedule}
            >
              <span>
                {eventDate === focus?.date
                  ? lesson.start
                  : `${formatInTimeZone(new Date(eventDate + "T12:00:00+03:00"), "Europe/Moscow", "d MMM", { locale: ru })} · ${lesson.start}`}
              </span>
              <strong>{lesson.subject}</strong>
              <small>
                {lessonType(lesson.type)} ·{" "}
                {lesson.rooms.map(teachingRoom).join(" / ") ||
                  "Аудитория не указана"}
              </small>
            </button>
          ))}
        </div>
      )}
      {fetchedAt && (
        <p className="flow-source">
          РУЗ ·{" "}
          {new Date(fetchedAt).toLocaleString("ru-RU", {
            timeZone: "Europe/Moscow",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          МСК
        </p>
      )}
      <button
        className="flow-reveal"
        type="button"
        onClick={openSchedule}
        aria-controls="full-day-schedule"
      >
        <span aria-hidden="true">↑</span> Всё расписание
      </button>
    </section>
  );
}
