"use client";

import { useEffect, useState } from "react";
import {
  parseUniversitySnapshot,
  MAX_UNIVERSITY_FILE_BYTES,
  type UniversitySnapshot,
} from "@/lib/university/snapshot";

const services = [
  [
    "Зачётка",
    "Оценки и результаты аттестаций",
    "https://my.spbstu.ru/science-and-education/recordbook/",
  ],
  [
    "Учебный план",
    "Дисциплины, семестры и формы контроля",
    "https://my.spbstu.ru/science-and-education/study_plan/",
  ],
  [
    "Коллеги",
    "Поиск сотрудников и студентов",
    "https://my.spbstu.ru/data-mart/dm-personalities/",
  ],
  [
    "Сообщения",
    "Университетские диалоги и рассылки",
    "https://my.spbstu.ru/messenger/",
  ],
  ["Корпоративная почта", "Почтовый ящик Политеха", "https://mail.spbstu.ru/"],
  [
    "Курсы DL",
    "Задания и материалы преподавателей",
    "https://dl.spbstu.ru/my/courses.php",
  ],
  ["OpenEdu", "Открытое образование", "https://openedu.ru/"],
] as const;

export function UniversityClient({ userId }: { userId: string }) {
  const storageKey = `sv-university-local-v1:${userId}`;
  const [copies, setCopies] = useState<UniversitySnapshot[]>([]);
  const [preview, setPreview] = useState<UniversitySnapshot | null>(null);
  const [active, setActive] = useState<"recordbook" | "study-plan">(
    "recordbook",
  );
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) || "[]",
      );
      if (Array.isArray(saved) && saved.length <= 2)
        setCopies(
          saved.map((copy) => parseUniversitySnapshot(JSON.stringify(copy))),
        );
    } catch {
      setError(
        "Не удалось открыть сохранённую копию. Её можно загрузить заново.",
      );
    }
    setLoaded(true);
  }, [storageKey]);
  const save = (next: UniversitySnapshot[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setCopies(next);
      setPreview(null);
      setError("");
    } catch {
      setError(
        "Браузер не разрешил сохранение. Освободите место или разрешите хранилище сайта.",
      );
    }
  };
  const copy = preview || copies.find((item) => item.kind === active);
  return (
    <div className="university-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Лично вам</p>
          <h1 className="page-title">Мой Политех</h1>
          <p className="page-intro">
            Учебные результаты рядом с расписанием и работами.
          </p>
        </div>
      </div>
      <section
        className="university-copy"
        aria-labelledby="private-copy-heading"
      >
        <p className="eyebrow">Личная копия на этом устройстве</p>
        <h2 id="private-copy-heading">Зачётка и учебный план</h2>
        <p>
          Добавьте копию таблицы из своего кабинета. Она останется на этом
          устройстве; перед сохранением можно проверить содержимое.
        </p>
        <details>
          <summary>Как получить копию</summary>
          <ol>
            <li>
              Откройте зачётку или учебный план по ссылке выше. В зачётке
              выберите нужный семестр и количество строк.
            </li>
            <li>
              В расширении Student Value нажмите «Прочитать открытую таблицу»,
              проверьте число строк и сохраните файл.
            </li>
            <li>
              Загрузите файл здесь. Это выбранные строки, а не автоматическая
              синхронизация всей зачётки.
            </li>
          </ol>
          <a
            href="/downloads/studentvalue-portal-bridge.zip"
            download
            className="text-link"
          >
            Скачать исходники расширения для Chrome
          </a>
          <p>
            Установка: chrome://extensions → «Режим разработчика» → «Загрузить
            распакованное расширение». Оно запрашивает только доступ к активной
            вкладке после вашего нажатия; пароли не читает.
          </p>
        </details>
        <label className="university-upload mt-4">
          Выбрать копию JSON
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={!loaded}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              try {
                if (file.size > MAX_UNIVERSITY_FILE_BYTES) throw new Error();
                const parsed = parseUniversitySnapshot(await file.text());
                setPreview(parsed);
                setActive(parsed.kind);
                setError("");
              } catch {
                setError(
                  "Файл не соответствует формату копии Student Value или превышает 1 МБ.",
                );
              }
            }}
          />
        </label>
        {error && (
          <p role="alert" className="text-[var(--wine)] mt-3">
            {error}
          </p>
        )}
        <div
          className="flex gap-5 mt-6"
          role="group"
          aria-label="Раздел личной копии"
        >
          {(
            [
              ["recordbook", "Зачётка"],
              ["study-plan", "Учебный план"],
            ] as const
          ).map(([kind, title]) => (
            <button
              type="button"
              className="text-link py-2"
              key={kind}
              aria-pressed={active === kind}
              onClick={() => {
                setActive(kind);
                setPreview(null);
              }}
            >
              {title}
            </button>
          ))}
        </div>
        {copy ? (
          <>
            <p className="text-sm text-[var(--ink-muted)] my-3">
              {preview ? "Предпросмотр · " : "Сохранено на этом устройстве · "}
              {new Date(copy.capturedAt).toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
              })}{" "}
              МСК · {copy.rows.length} строк
            </p>
            {copy.context && <p className="text-sm mb-3">{copy.context}</p>}
            <p className="text-xs text-[var(--ink-muted)] mb-4">
              Личная импортированная копия. Файл не удостоверяет результат
              преподавателя и не влияет на XP, допуск или общие задания.
              Сведения могут быть неполными и устаревать.
            </p>
            <div className="university-table-scroll">
              <table>
                <thead>
                  <tr>
                    {copy.columns.map((column, index) => (
                      <th key={index}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {copy.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
              {preview ? (
                <>
                  <button
                    type="button"
                    className="university-save"
                    onClick={() =>
                      save([
                        ...copies.filter((item) => item.kind !== preview.kind),
                        preview,
                      ])
                    }
                  >
                    Сохранить только на этом устройстве
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setPreview(null)}
                  >
                    Отменить
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    save(copies.filter((item) => item.kind !== active))
                  }
                >
                  Убрать эту копию с устройства
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="py-6 text-sm text-[var(--ink-muted)]">
            Копия ещё не загружена. Актуальные данные доступны в вашем
            университетском кабинете.
          </p>
        )}
        <details className="mt-6">
          <summary>Где хранятся данные</summary>
          <p className="text-xs text-[var(--ink-muted)]">
            Копии хранятся в localStorage этого браузера отдельно для вашего
            аккаунта. На сервер, другим студентам, старосте и в Google Calendar
            они не отправляются. Очистка данных сайта удалит копии; на другом
            устройстве нужно загрузить их заново. Кнопка «Выйти» в профиле также
            удаляет вашу копию из этого браузера. На общем компьютере проверьте
            её удаление перед завершением работы. Для открытия личного раздела
            требуется действующий вход Student Value; автономный вход сюда пока
            не поддерживается.
          </p>
        </details>
      </section>
      <h2 className="mt-10 text-xl">В университетском кабинете</h2>
      <nav className="university-services" aria-label="Сервисы Политеха">
        {services.map(([name, description, url]) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            <span>
              <strong>{name}</strong>
              <small>{description}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
