"use client";

import { CompleteWorkButton } from "./CompleteWorkButton";
import React, { useState, useTransition, useId } from "react";
import { StudentTaskProgressStatus, VerificationSource } from "@prisma/client";
import {
  updateStudentProgressAction,
  verifyTaskProgressAction,
} from "@/server/actions/task-actions";
import { formatVerificationSource } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/Badge";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface StatusSelectProps {
  taskId: string;
  targetUserId: string;
  currentStatus: StudentTaskProgressStatus;
  isVerified: boolean;
  verifiedAt?: string | null;
  verificationSource?: string | null;
  canVerify: boolean; // Has verify_progress permission
  isCurrentUser: boolean;
}

export function StatusSelect({
  taskId,
  targetUserId,
  currentStatus,
  isVerified,
  verifiedAt,
  verificationSource,
  canVerify,
  isCurrentUser,
}: StatusSelectProps) {
  const selectId = useId();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getStatusBadge = (
    status: StudentTaskProgressStatus,
    verified: boolean,
  ) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <Badge
            variant={verified ? "success" : "warning"}
            className="gap-1.5 font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {verified
              ? "Результат подтверждён"
              : "Подтверждение требует проверки"}
          </Badge>
        );
      case "SUBMITTED":
        return (
          <Badge variant="info" className="gap-1.5">
            <FileCheck className="w-3.5 h-3.5" />
            Выполнено · отправлено
          </Badge>
        );
      case "READY":
        return (
          <Badge variant="warning" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Выполнено · моя отметка
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="default" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />В работе
          </Badge>
        );
      case "NEEDS_FIX":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Требуются правки
          </Badge>
        );
      case "NOT_STARTED":
      default:
        return (
          <Badge variant="muted" className="gap-1.5">
            Не начато
          </Badge>
        );
    }
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as StudentTaskProgressStatus;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        await updateStudentProgressAction(taskId, val);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("Произошла ошибка при смене статуса");
        }
      }
    });
  };

  const handleVerify = (accept: boolean) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await verifyTaskProgressAction(
          taskId,
          targetUserId,
          accept,
          VerificationSource.HEADMAN_CONFIRMED,
        );
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("Ошибка верификации");
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {getStatusBadge(currentStatus, isVerified)}
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-sky-400" />}
      </div>

      {isVerified && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>
            {formatVerificationSource(verificationSource)}
            {verifiedAt
              ? ` • ${new Date(verifiedAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`
              : ""}
          </span>
        </div>
      )}

      {isCurrentUser && (
        <CompleteWorkButton
          taskId={taskId}
          complete={["READY", "SUBMITTED", "ACCEPTED"].includes(currentStatus)}
          accepted={currentStatus === "ACCEPTED"}
        />
      )}
      {/* Student self-reported control */}
      {isCurrentUser && (
        <div className="flex flex-col gap-1 mt-1">
          <label htmlFor={selectId} className="text-xs text-slate-400">
            Мой этап работы
          </label>
          <select
            id={selectId}
            aria-label="Мой этап работы"
            value={currentStatus}
            onChange={handleStudentChange}
            disabled={isPending || currentStatus === "ACCEPTED"}
            className="min-h-11 w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 cursor-pointer disabled:opacity-50"
          >
            <option value="NOT_STARTED">Не начато</option>
            <option value="IN_PROGRESS">В работе</option>
            {currentStatus === "NEEDS_FIX" && (
              <option value="NEEDS_FIX" disabled>
                Нужны правки
              </option>
            )}
            <option value="READY">Выполнено</option>
            <option value="SUBMITTED">Отправлено на проверку</option>
            <option value="ACCEPTED" disabled>
              Зачёт преподавателя
            </option>
          </select>
        </div>
      )}

      {/* Verification control for Headman / Admin */}
      {canVerify && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400">Верификация:</span>
          <button
            onClick={() => handleVerify(true)}
            disabled={isPending || (currentStatus === "ACCEPTED" && isVerified)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded font-medium disabled:opacity-40 cursor-pointer transition-colors"
          >
            Подтвердить результат
          </button>
          <button
            onClick={() => handleVerify(false)}
            disabled={isPending || currentStatus === "NEEDS_FIX"}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-medium disabled:opacity-40 cursor-pointer transition-colors"
          >
            На доработку
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2 rounded mt-1"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
