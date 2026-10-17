"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchGroupAction } from "@/server/actions/group-actions";
export function GroupSwitcher({
  groups,
  current,
}: {
  groups: { id: string; name: string; code: string }[];
  current: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="block text-xs text-slate-400 my-3">
      Учебное пространство
      <select
        aria-label="Текущая группа"
        value={current}
        disabled={pending}
        className="block w-full rounded-lg border border-slate-600 bg-[#142139] px-3 min-h-11 text-sm text-white mt-2"
        onChange={(e) => {
          const id = e.target.value;
          start(async () => {
            await switchGroupAction(id);
            router.push("/");
            router.refresh();
          });
        }}
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
}
