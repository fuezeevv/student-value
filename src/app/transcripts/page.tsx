import React from "react";
import fs from "fs/promises";
import path from "path";
import { TranscriptViewer, TranscriptItem } from "./TranscriptViewer";
import { FileText } from "lucide-react";

export default async function TranscriptsPage() {
  const localPolytechDir = "/Users/fuezeev/Documents/Файлы/Политех";

  const transcriptDefinitions = [
    {
      id: "vr-0709-intro",
      course: "ИКГ / VR",
      title: "07.09 Организационное занятие: выбор траектории (JS / Blender)",
      date: "07.09.2026",
      teacher: "Болсуновская М.В.",
      audioFile: "07-09 Графика VR Орг №1 Болсуновская ч1.m4a",
      filePath: path.join(localPolytechDir, "Инженерная графика VR/07-09 Графика VR Орг №1 Болсуновская ч1.txt"),
      extractedFacts: [
        "Дисциплина идет в двух траекториях: стандартная (дистанционно, моделирование трехмерных объектов на JS) и углубленная (очно в лаборатории, Blender).",
        "Для обеих траекторий итоговый результат — трехмерный объект / курсовой проект.",
        "Необходимо пройти опрос/голосование в СДО.",
      ],
    },
    {
      id: "mmpp-0709-lecture1",
      course: "ММФП",
      title: "07.09 Лекция №1: Введение и классификация датчиков",
      date: "07.09.2026",
      teacher: "Сушников Виктор Александрович",
      audioFile: "07-09 Мат моделирование Лекция №1 Сушников.m4a",
      filePath: path.join(localPolytechDir, "Математическое моделирование/07-09 Мат моделирование Лекция №1 Сушников.txt"),
      extractedFacts: [
        "Цель 5 семестра: понять, что лежит под капотом сенсоров и датчиков, математическое моделирование физических процессов.",
        "Второй семестр (6 семестр) — практика и курсовой проект.",
        "Вводная лабораторная работа №1 запланирована на 1 час.",
      ],
    },
    {
      id: "mmpp-1809-lab1",
      course: "ММФП",
      title: "18.09 Лабораторная работа №1: Практическое моделирование сенсоров",
      date: "18.09.2026",
      teacher: "Сушников Виктор Александрович",
      audioFile: "18-09 Мат моделирование Лаб №1 Сушников.m4a",
      filePath: path.join(localPolytechDir, "Математическое моделирование/18-09 Мат моделирование Лаб №1 Сушников.txt"),
      extractedFacts: [
        "Порядок работы в лаборатории с моделями датчиков.",
        "Анализ физических зависимостей входного воздействия и выходного сигнала сенсора.",
      ],
    },
    {
      id: "otu-1609-lecture3",
      course: "ОТУ",
      title: "16.09 Лекция №3: Передаточные функции и структурные схемы",
      date: "16.09.2026",
      teacher: "Нестеров С.А.",
      audioFile: "16-09 ОТУ Лекция №3 Нестеров.m4a",
      filePath: path.join(localPolytechDir, "Основы теории управления/16_09 ОТУ Лекция №3 Нестеров.srt"),
      extractedFacts: [
        "Аналитический расчет эквивалентных передаточных функций.",
        "Построение логарифмических частотных характеристик (ЛАЧХ и ЛФЧХ).",
      ],
    },
  ];

  const loadedTranscripts: TranscriptItem[] = [];

  for (const item of transcriptDefinitions) {
    let fullText = "";
    try {
      fullText = await fs.readFile(item.filePath, "utf-8");
    } catch {
      fullText = "Текст транскрипции не найден по локальному пути.";
    }

    loadedTranscripts.push({
      id: item.id,
      course: item.course,
      title: item.title,
      date: item.date,
      teacher: item.teacher,
      audioFile: item.audioFile,
      excerpt: fullText.slice(0, 300) + "...",
      fullText,
      extractedFacts: item.extractedFacts,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-cyan-400" />
          Транскрипции занятий и материалы
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Стенограммы лекций и практик, извлеченные требования и поиск по первоисточникам
        </p>
      </div>

      <TranscriptViewer transcripts={loadedTranscripts} />
    </div>
  );
}
