"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { publicGroups } from "@/lib/groups/public-groups";

export function GuestGroupSelect() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <select
      aria-label="Выбрать группу без регистрации"
      defaultValue=""
      disabled={!ready}
      onChange={(e) => {
        const code = e.target.value;
        if (code) {
          router.push(`/browse/${code.replace("/", "-")}`);
        }
      }}
      className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-active)] text-[var(--ink)] font-bold text-xs cursor-pointer focus:outline-none hover:border-[var(--wine)] transition-colors shadow-xs"
    >
      <option
        value=""
        disabled
        className="bg-[var(--surface)] text-[var(--ink)]"
      >
        Выбрать группу ▾
      </option>
      {publicGroups.map((g) => (
        <option
          key={g.code}
          value={g.code}
          className="bg-[var(--surface)] text-[var(--ink)]"
        >
          {g.track} · {g.code}
        </option>
      ))}
    </select>
  );
}
