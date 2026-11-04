"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const router = useRouter();
  const selected = groups.findIndex((group) => group.id === current);
  const active = groups[selected];
  useEffect(() => {
    if (open) options.current[focused]?.focus();
  }, [open, focused]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function show(index = Math.max(0, selected)) {
    setFocused(index);
    setOpen(true);
  }
  function choose(groupId: string) {
    setOpen(false);
    trigger.current?.focus();
    if (groupId === current) return;
    setError("");
    start(async () => {
      try {
        await switchGroupAction(groupId);
        router.push("/");
        router.refresh();
      } catch {
        setError("Не удалось сменить группу. Попробуйте ещё раз.");
      }
    });
  }
  if (!active) return null;
  return (
    <div
      ref={root}
      className="group-switcher"
      onKeyDownCapture={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span className="group-switcher-label" id={`${id}-label`}>
        Учебное пространство
      </span>
      {groups.length === 1 ? (
        <div className="group-current" aria-label="Текущая группа">
          <span>
            {active.name}
            {!active.name.includes(active.code) && <small>{active.code}</small>}
          </span>
        </div>
      ) : (
        <>
          <button
            type="button"
            ref={trigger}
            className="group-switcher-trigger"
            aria-label={`Текущая группа: ${active.name}`}
            aria-haspopup="listbox"
            aria-controls={`${id}-options`}
            aria-expanded={open}
            disabled={pending}
            onClick={() => (open ? setOpen(false) : show())}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                event.preventDefault();
                show();
              }
            }}
          >
            <span>
              {pending ? "Переключаем группу…" : active.name}
              {!pending && !active.name.includes(active.code) && (
                <small>{active.code}</small>
              )}
            </span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>
          {open && (
            <div
              id={`${id}-options`}
              className="group-options"
              role="listbox"
              aria-labelledby={`${id}-label`}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowDown"
                    ? (focused + 1) % groups.length
                    : event.key === "ArrowUp"
                      ? (focused - 1 + groups.length) % groups.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? groups.length - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setFocused(next);
                }
              }}
            >
              {groups.map((group, index) => (
                <button
                  type="button"
                  key={group.id}
                  ref={(element) => {
                    options.current[index] = element;
                  }}
                  role="option"
                  aria-selected={group.id === current}
                  tabIndex={focused === index ? 0 : -1}
                  className="group-option"
                  onFocus={() => setFocused(index)}
                  onClick={() => choose(group.id)}
                >
                  <span>
                    {group.name}
                    {!group.name.includes(group.code) && (
                      <small>{group.code}</small>
                    )}
                  </span>
                  {group.id === current && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="group-switcher-error">
          {error}
        </p>
      )}
    </div>
  );
}
