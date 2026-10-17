"use client";
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { FormResult } from "@/server/actions/action-result";
import { inputClass } from "./styles";
export function OperationForm({
  action,
  children,
  label = "Сохранить",
  className = "",
  reset = false,
}: {
  action: (data: FormData) => Promise<FormResult>;
  children: ReactNode;
  label?: string;
  className?: string;
  reset?: boolean;
}) {
  const [pending, start] = useTransition(),
    [result, setResult] = useState<FormResult>({}),
    [copied, setCopied] = useState(false);
  return (
    <form
      className={`space-y-5 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setResult({});
        setCopied(false);
        start(async () => {
          try {
            const next = await action(data);
            setResult(next);
            if (reset && !next.error) form.reset();
          } catch {
            setResult({
              error: "Не удалось связаться с сервером. Попробуйте ещё раз.",
            });
          }
        });
      }}
    >
      {children}
      <button className="action-primary disabled:opacity-50" disabled={pending}>
        {pending ? "Сохраняю…" : label}
      </button>
      {result.error && (
        <p role="alert" className="text-sm text-rose-300">
          {result.error}
        </p>
      )}
      {result.message && (
        <p role="status" className="text-sm text-blue-200">
          {result.message}
        </p>
      )}
      {result.href && (
        <Link className="text-link block" href={result.href}>
          Открыть ↗
        </Link>
      )}
      {result.code && (
        <div className="rounded-xl border border-blue-400/40 p-4 space-y-3">
          <p className="text-sm">
            Персональный код действует 72 часа и подходит только для указанного
            Google email. Новый код отзывает предыдущий. Передайте его этому
            человеку вместе со ссылкой{" "}
            {typeof window !== "undefined" ? window.location.origin : ""}/join.
          </p>
          <textarea
            aria-label="Персональный код приглашения"
            readOnly
            value={result.code}
            className={`${inputClass} font-mono text-xs min-h-24`}
          />
          <button
            type="button"
            className="text-link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.code!);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Скопировано" : "Скопировать код"}
          </button>
        </div>
      )}
    </form>
  );
}
