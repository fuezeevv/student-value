"use client";

import { HighlightedText } from "@/components/text/HighlightedText";
import React, { useState } from "react";
import { Search, FileText, Clock, ExternalLink, BookOpen, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export interface TranscriptItem {
  id: string;
  course: string;
  title: string;
  date: string;
  teacher: string;
  audioFile?: string;
  excerpt: string;
  fullText: string;
  extractedFacts: string[];
}

export function TranscriptViewer({ transcripts }: { transcripts: TranscriptItem[] }) {
  const [selectedId, setSelectedId] = useState<string>(transcripts[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = transcripts.find((t) => t.id === selectedId) || transcripts[0];

  const filteredLines = selected?.fullText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .filter((line) =>
      searchQuery ? line.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Transcript List (4 cols) */}
      <div className="lg:col-span-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Доступные записи и транскрипции ({transcripts.length})
        </h2>
        <div className="space-y-2">
          {transcripts.map((t) => {
            const isCurrent = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedId(t.id);
                  setSearchQuery("");
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(0,229,255,0.1)]"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {t.course}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-mono">{t.date}</span>
                </div>
                <h3 className="font-medium text-xs text-slate-200 line-clamp-1 mb-1">
                  {t.title}
                </h3>
                <div className="text-[11px] text-slate-400">
                  {t.teacher}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Transcript Reader & Search (8 cols) */}
      <div className="lg:col-span-8 space-y-4">
        {selected ? (
          <Card className="glass-panel border-slate-800 p-5 space-y-4">
            {/* Header info */}
            <div className="space-y-2 pb-3 border-b border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="default" className="text-xs">
                  {selected.course}
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Дата записи: {selected.date}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {selected.title}
              </h2>
              <div className="text-xs text-slate-400">
                Преподаватель: <strong className="text-slate-200">{selected.teacher}</strong>
                {selected.audioFile && (
                  <span className="ml-3 font-mono text-cyan-400/80">
                    Аудио: {selected.audioFile}
                  </span>
                )}
              </div>
            </div>

            {/* Extracted Facts Pill Callout */}
            {selected.extractedFacts.length > 0 && (
              <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 space-y-2">
                <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ключевые факты и требования из занятия:</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-300">
                  {selected.extractedFacts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Search within transcript */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Поиск по фразам и терминам в стенограмме..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
              />
            </div>

            {/* Transcript text container */}
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 font-mono text-xs text-slate-300 leading-relaxed border border-slate-800/80 rounded-lg p-4 bg-slate-950/60">
              {filteredLines && filteredLines.length > 0 ? (
                filteredLines.map((line, idx) => (
                  <p key={idx} className="hover:bg-cyan-500/5 px-1 py-0.5 rounded">
                    <HighlightedText text={line} query={searchQuery} />
                  </p>
                ))
              ) : (
                <p className="text-slate-500 text-center py-6">
                  Фрагментов по запросу «{searchQuery}» не найдено.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <div className="p-8 text-center text-slate-400">Транскрипции не найдены.</div>
        )}
      </div>
    </div>
  );
}
