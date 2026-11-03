"use client";
import { useState } from "react";
export function FileDownload({
  id,
  filename,
  byteSize,
  sha256,
  shared = false,
}: {
  id: string;
  filename: string;
  byteSize: number;
  sha256: string;
  shared?: boolean;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const parts: ArrayBuffer[] = [];
      const chunks = Math.ceil(byteSize / (1024 * 1024));
      for (let i = 0; i < chunks; i++) {
        setStatus(`Загрузка: ${Math.round((i / chunks) * 100)}%`);
        const response = await fetch(
          `/api/${shared ? "exchange/" : ""}materials/${encodeURIComponent(id)}/file?chunk=${i}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw Error();
        parts.push(await response.arrayBuffer());
      }
      const blob = new Blob(parts, { type: "application/octet-stream" });
      if (blob.size !== byteSize) throw Error();
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ),
        (x) => x.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== sha256) throw Error();
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus("Файл загружен и проверен");
    } catch {
      setStatus("Не удалось загрузить целый файл. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="action-primary" disabled={busy} onClick={download}>
        Скачать исходный файл
      </button>
      <p role="status" className="text-sm text-slate-400 mt-4">
        {status}
      </p>
    </div>
  );
}
