import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  Image,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type {
  MobileLesson,
  MobileTimetable,
  UserTaskProgress,
  CachedTask,
} from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";
import {
  syncTimetableFromApi,
  getActiveApiOrigin,
  setActiveApiOrigin,
} from "../api/client";
import {
  getSessionUser,
  getSessionToken,
  type MobileSessionUser,
} from "../auth/token-storage";
import { enqueueProgressUpdate, flushOutbox } from "../sync/outbox";
import { DaySwitcher, type DayItem } from "../components/DaySwitcher";
import { FlowHeroCard } from "../components/FlowHeroCard";
import { FullDayLessonList } from "../components/FullDayLessonList";
import { GroupPickerModal } from "../components/GroupPickerModal";
import { AuthModal } from "../components/AuthModal";
import { TaskProgressCard } from "../components/TaskProgressCard";
import { MaterialModal } from "../components/MaterialModal";
import {
  scheduleDeadlineReminder,
  cancelDeadlineReminder,
  setupNotificationChannels,
} from "../notifications/scheduler";

function getMoscowDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getMoscowNowMinutes(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function addDays(dateStr: string, count: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}

function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0, 10);
}

function calculateAcademicWeek(dateStr: string): {
  weekNumber: number;
  isEven: boolean;
  parityLabel: string;
} {
  const d = new Date(dateStr + "T12:00:00+03:00");
  const year = d.getFullYear();
  const startYear = d.getMonth() < 7 ? year - 1 : year;
  const sept1 = new Date(`${startYear}-09-01T12:00:00+03:00`);
  const dayOfWeek = (sept1.getDay() + 6) % 7;
  const firstMonday = new Date(sept1);
  firstMonday.setDate(sept1.getDate() - dayOfWeek);

  const diffDays = Math.floor(
    (d.getTime() - firstMonday.getTime()) / 86400000,
  );
  const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);
  const isEven = weekNumber % 2 === 0;
  return {
    weekNumber,
    isEven,
    parityLabel: `${weekNumber}-я неделя · ${isEven ? "Чётная" : "Нечётная"}`,
  };
}

function formatAge(isoString: string | null): string {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0 || isNaN(diffMs)) return "";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

function getGroupDisplayLabel(groupCode: string): string {
  if (groupCode.startsWith("5130901/")) {
    return `ИВТ-${groupCode.slice(8, 11)}`;
  }
  if (groupCode.startsWith("5130902/")) {
    return `ИСиТ-${groupCode.slice(8, 11)}`;
  }
  return groupCode;
}

const RU_MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const RU_DAYS_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const RU_DAYS_FULL = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

export const FlowTimetableScreen: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<string>("5130901/40102");
  const [todayStr, setTodayStr] = useState<string>(() => getMoscowDateString());
  const [nowMoscowMin, setNowMoscowMin] = useState<number>(() => getMoscowNowMinutes());
  const [selectedDate, setSelectedDate] = useState<string>(() => getMoscowDateString());
  const [viewMode, setViewMode] = useState<"flow" | "full">("flow");
  const [groupPickerVisible, setGroupPickerVisible] = useState<boolean>(false);

  // Storage states
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [lessons, setLessons] = useState<MobileLesson[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sourceFetchedAt, setSourceFetchedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [apiOrigin, setApiOrigin] = useState<string>("https://studentvalue1984.eu.cc");

  // Current week snapshot
  const [weekSnapshot, setWeekSnapshot] = useState<MobileTimetable | null>(null);

  // Auth and task progress states (Stage B)
  const [sessionUser, setSessionUser] = useState<MobileSessionUser | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [pendingOpsCount, setPendingOpsCount] = useState<number>(0);
  const [taskProgress, setTaskProgress] = useState<Record<string, UserTaskProgress>>({});
  const [isUpdatingProgress, setIsUpdatingProgress] = useState<boolean>(false);

  // Material and Reminder states (Stage C)
  const [materialModalVisible, setMaterialModalVisible] = useState<boolean>(false);
  const [activeMaterialModalId, setActiveMaterialModalId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<CachedTask[]>([]);
  const [scheduledReminders, setScheduledReminders] = useState<Record<string, boolean>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const repo = useMemo(() => getTimetableRepository(), []);
  const reqGenRef = useRef(0);

  // Load active API origin and notification channels from storage on mount
  useEffect(() => {
    getActiveApiOrigin().then(setApiOrigin);
    setupNotificationChannels().catch(() => {});
  }, []);

  const loadTasks = useCallback(
    async (groupCode: string, user: MobileSessionUser | null) => {
      // 1. Initial cached tasks from SQLite
      try {
        const cached = await repo.getCachedTasksForGroup(groupCode);
        if (cached.length > 0) {
          setTasks(cached);
        }
      } catch (err) {
        console.warn("Could not read cached tasks from SQLite:", err);
      }

      // 2. Fetch fresh tasks from API
      try {
        const origin = await getActiveApiOrigin();
        const token = await getSessionToken();
        const headers: Record<string, string> = {};
        if (token && user) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(
          `${origin}/api/v1/tasks?group=${encodeURIComponent(groupCode)}`,
          { headers },
        );
        if (res.ok) {
          const data = await res.json();
          const serverTasks = data.tasks || [];
          const mapped: CachedTask[] = serverTasks.map((t: any) => ({
            id: t.id,
            groupCode,
            title: t.title,
            subject: t.subject,
            type: t.type,
            deadlineId: t.deadline?.id ?? null,
            deadlineDate: t.deadline?.date ?? null,
            deadlineMoscowStr: t.deadline?.dateMoscowStr ?? null,
            deadlineStatus: t.deadline?.status ?? null,
            materialId: t.material?.id ?? null,
            materialTitle: t.material?.title ?? null,
            materialFilename: t.material?.filename ?? null,
            materialByteSize: t.material?.byteSize ?? null,
            materialMimeType: t.material?.mimeType ?? null,
            materialSha256: t.material?.sha256 ?? null,
            updatedAt: new Date().toISOString(),
          }));
          await repo.saveCachedTasksForGroup(groupCode, mapped);
          setTasks(mapped);

          // Populate task progress from server response if authenticated
          if (user) {
            const progMap: Record<string, UserTaskProgress> = {};
            const remMap: Record<string, boolean> = {};
            for (const t of serverTasks) {
              if (t.progress) {
                progMap[t.id] = {
                  userId: user.id,
                  taskId: t.id,
                  status: t.progress.status,
                  isVerified: t.progress.isVerified,
                  studentNotes: t.progress.studentNotes,
                  completedAt: t.progress.completedAt,
                  updatedAt: t.progress.updatedAt,
                  syncState: "SYNCED",
                };
                await repo.saveUserProgress(progMap[t.id]);
              }
              const notifs = await repo.getScheduledNotificationsForTask(user.id, t.id);
              remMap[t.id] = notifs.some((n) => n.status === "SCHEDULED");
            }
            setTaskProgress((prev) => ({ ...prev, ...progMap }));
            setScheduledReminders(remMap);
          }
        }
      } catch {
        // Network offline: retain SQLite cache
      }
    },
    [repo],
  );

  // Load session user, outbox count and tasks on mount
  useEffect(() => {
    getSessionUser().then(async (u) => {
      setSessionUser(u);
      if (u) {
        const ops = await repo.getPendingOperations(u.id);
        setPendingOpsCount(ops.length);
        const progressList = await repo.getAllUserProgress(u.id);
        const map: Record<string, UserTaskProgress> = {};
        for (const p of progressList) {
          map[p.taskId] = p;
        }
        setTaskProgress(map);

        // Try initial outbox flush
        flushOutbox()
          .then(async () => {
            const freshOps = await repo.getPendingOperations(u.id);
            setPendingOpsCount(freshOps.length);
            const freshProgress = await repo.getAllUserProgress(u.id);
            const freshMap: Record<string, UserTaskProgress> = {};
            for (const p of freshProgress) {
              freshMap[p.taskId] = p;
            }
            setTaskProgress(freshMap);
          })
          .catch(() => {});
      }
      await loadTasks(selectedGroup, u);
    });
  }, [repo, selectedGroup, loadTasks]);

  // Live timer for ongoing lesson progress and midnight day rollover
  useEffect(() => {
    const updateTime = () => {
      const newToday = getMoscowDateString();
      const newMin = getMoscowNowMinutes();
      setNowMoscowMin(newMin);
      setTodayStr((prevToday) => {
        if (prevToday !== newToday) {
          // Midnight rolled over: update selectedDate if user was on previous today
          setSelectedDate((curr) => (curr === prevToday ? newToday : curr));
          return newToday;
        }
        return prevToday;
      });
    };

    const interval = setInterval(updateTime, 10000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") updateTime();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  // Restore persistent selected group from SQLite on launch
  useEffect(() => {
    repo.getPreference("selected_group_code").then((saved) => {
      if (saved) {
        setSelectedGroup(saved);
      }
    });
  }, [repo]);

  // 1. Cold start directly from SQLite repository (Zero network wait)
  const loadFromSqlite = useCallback(async () => {
    try {
      const res = await repo.getDayTimetable(selectedGroup, selectedDate);
      if (res.status === "loaded") {
        setIsLoaded(true);
        setLessons(res.lessons);
        setSavedAt(res.savedAt);
        setSourceFetchedAt(res.sourceFetchedAt);
        setIsStale(res.isStale);
      } else {
        setIsLoaded(false);
        setLessons([]);
        setSavedAt(null);
        setSourceFetchedAt(null);
      }

      // Also load full week for day dots
      const weekStart = weekStartFor(selectedDate);
      const stored = await repo.getSnapshot(selectedGroup, weekStart);
      setWeekSnapshot(stored?.snapshot ?? null);
    } catch {
      setIsLoaded(false);
      setLessons([]);
    }
  }, [repo, selectedGroup, selectedDate]);

  // Load from SQLite on mount and whenever group/date changes, then trigger background sync
  useEffect(() => {
    const currentGen = ++reqGenRef.current;
    loadFromSqlite().then(() => {
      if (currentGen !== reqGenRef.current) return;

      // Background non-blocking network sync
      setIsSyncing(true);
      syncTimetableFromApi(selectedGroup, selectedDate).then((result) => {
        if (currentGen !== reqGenRef.current) return;
        setIsSyncing(false);

        if (result.success) {
          setSyncMessage(null);
          loadFromSqlite();
        } else {
          if (result.reason === "OFFLINE") {
            setSyncMessage("Офлайн-режим · Расписание из памяти устройства");
          } else if (result.reason === "UNAVAILABLE") {
            setSyncMessage(result.message);
          } else if (result.reason === "ENDPOINT_NOT_FOUND") {
            setSyncMessage(result.message);
          } else if (result.reason === "SCHEMA_ERROR") {
            setSyncMessage("Ошибка формата ответа от сервера");
          } else {
            setSyncMessage(result.message);
          }
        }
      });
    });
  }, [loadFromSqlite, selectedGroup, selectedDate]);

  // Manual refresh trigger
  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    const result = await syncTimetableFromApi(selectedGroup, selectedDate);
    setIsSyncing(false);

    if (result.success) {
      setSyncMessage(null);
      await loadFromSqlite();
    } else {
      setSyncMessage(result.message);
      await loadFromSqlite();
    }
  };

  const handleSelectGroup = (code: string) => {
    setSelectedGroup(code);
    repo.setPreference("selected_group_code", code);
    setGroupPickerVisible(false);
  };

  const handleSelectOrigin = async (newOrigin: string) => {
    setApiOrigin(newOrigin);
    await setActiveApiOrigin(newOrigin);
    setGroupPickerVisible(false);
    setIsSyncing(true);
    setSyncMessage(null);
    const result = await syncTimetableFromApi(selectedGroup, selectedDate, newOrigin);
    setIsSyncing(false);
    if (result.success) {
      setSyncMessage(null);
      await loadFromSqlite();
    } else {
      setSyncMessage(result.message);
      await loadFromSqlite();
    }
  };

  // Day navigation
  const handlePrevDay = () => {
    setSelectedDate((prev) => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  // Format header month and parity
  const weekStart = weekStartFor(selectedDate);
  const selectedDateObj = new Date(selectedDate + "T12:00:00Z");
  const monthName = RU_MONTHS[selectedDateObj.getUTCMonth()];
  const year = selectedDateObj.getUTCFullYear();
  const monthYearLabel = `${monthName} ${year}`;
  const academicWeek = calculateAcademicWeek(selectedDate);

  // Build 7 DayItems for DaySwitcher
  const days: DayItem[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const dayNum = d.slice(8);
      const dayLabel = RU_DAYS_SHORT[i];
      const isToday = d === todayStr;

      const dayLessons =
        weekSnapshot?.data?.days.find((item) => item.date === d)?.lessons ?? [];
      const hasLessons = dayLessons.length > 0;

      return {
        date: d,
        dayNumber: dayNum,
        dayLabel,
        isToday,
        hasLessons,
      };
    });
  }, [weekStart, todayStr, weekSnapshot]);

  // Date eyebrow: e.g. "Понедельник, 16 ноября"
  const dayNameFull = RU_DAYS_FULL[selectedDateObj.getUTCDay()];
  const dayNumber = selectedDateObj.getUTCDate();
  const dateFullLabel = `${dayNameFull}, ${dayNumber} ${monthName}`;

  // Determine hero lesson (current ongoing or next upcoming)
  const isSelectedToday = selectedDate === todayStr;

  const { heroLesson, remainingLessons, allDoneToday } = useMemo(() => {
    if (!lessons.length) {
      return { heroLesson: null, remainingLessons: [], allDoneToday: false };
    }

    if (!isSelectedToday) {
      return {
        heroLesson: lessons[0],
        remainingLessons: lessons.slice(1),
        allDoneToday: false,
      };
    }

    const parseMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    // Find ongoing lesson (start <= now < start + 90)
    const ongoing = lessons.find((l) => {
      const s = parseMin(l.start);
      return nowMoscowMin >= s && nowMoscowMin < s + 90;
    });

    if (ongoing) {
      const remaining = lessons.filter(
        (l) => parseMin(l.start) >= parseMin(ongoing.start) && l.id !== ongoing.id,
      );
      return {
        heroLesson: ongoing,
        remainingLessons: remaining,
        allDoneToday: false,
      };
    }

    // Find next upcoming lesson (start > now)
    const next = lessons.find((l) => parseMin(l.start) > nowMoscowMin);
    if (next) {
      const remaining = lessons.filter(
        (l) => parseMin(l.start) >= parseMin(next.start) && l.id !== next.id,
      );
      return {
        heroLesson: next,
        remainingLessons: remaining,
        allDoneToday: false,
      };
    }

    // All classes finished for today
    return { heroLesson: null, remainingLessons: [], allDoneToday: true };
  }, [lessons, isSelectedToday, nowMoscowMin]);

  const handleToggleTaskStatus = async (
    taskId: string,
    currentStatus: string,
  ) => {
    if (!sessionUser) {
      setAuthModalVisible(true);
      return;
    }

    const newStatus =
      currentStatus === "READY" || currentStatus === "SUBMITTED"
        ? "IN_PROGRESS"
        : "READY";

    setUpdatingTaskId(taskId);
    try {
      const { optimisticProgress } = await enqueueProgressUpdate(
        taskId,
        newStatus,
      );
      setTaskProgress((prev) => ({ ...prev, [taskId]: optimisticProgress }));
      setPendingOpsCount((c) => c + 1);

      const report = await flushOutbox();
      if (report.succeeded > 0) {
        const updated = await repo.getUserProgress(sessionUser.id, taskId);
        if (updated) {
          setTaskProgress((prev) => ({ ...prev, [taskId]: updated }));
        }
      }
      const remainingOps = await repo.getPendingOperations(sessionUser.id);
      setPendingOpsCount(remainingOps.length);

      // Notification update with real deadline if configured
      const targetTask = tasks.find((t) => t.id === taskId);
      if (targetTask?.deadlineId && targetTask.deadlineDate) {
        if (newStatus === "READY") {
          await cancelDeadlineReminder(
            sessionUser.id,
            taskId,
            targetTask.deadlineId,
          );
          setScheduledReminders((prev) => ({ ...prev, [taskId]: false }));
        } else {
          const scheduled = await scheduleDeadlineReminder({
            userId: sessionUser.id,
            taskId,
            deadlineId: targetTask.deadlineId,
            taskTitle: targetTask.title,
            subjectName: targetTask.subject,
            deadlineDateStr: targetTask.deadlineDate,
          });
          if (scheduled) {
            setScheduledReminders((prev) => ({ ...prev, [taskId]: true }));
          }
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Ошибка отметки",
        err.message || "Не удалось сохранить отметку",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleToggleReminderForTask = async (task: CachedTask) => {
    if (!sessionUser) {
      setAuthModalVisible(true);
      return;
    }
    if (!task.deadlineId || !task.deadlineDate) {
      Alert.alert(
        "Дедлайн не установлен",
        "Для этого задания нет подтверждённого срока сдачи.",
      );
      return;
    }

    const isCurrentScheduled = Boolean(scheduledReminders[task.id]);

    if (isCurrentScheduled) {
      await cancelDeadlineReminder(sessionUser.id, task.id, task.deadlineId);
      setScheduledReminders((prev) => ({ ...prev, [task.id]: false }));
      Alert.alert("Напоминание", "Напоминание о дедлайне отключено.");
    } else {
      const scheduled = await scheduleDeadlineReminder({
        userId: sessionUser.id,
        taskId: task.id,
        deadlineId: task.deadlineId,
        taskTitle: task.title,
        subjectName: task.subject,
        deadlineDateStr: task.deadlineDate,
      });
      if (scheduled) {
        setScheduledReminders((prev) => ({ ...prev, [task.id]: true }));
        Alert.alert(
          "Напоминание установлено",
          `Напоминание запланировано за 24ч до срока (${task.deadlineMoscowStr}) в 10:00 по Москве.`,
        );
      } else {
        Alert.alert(
          "Срок сдачи прошёл",
          "Дедлайн уже наступил, напоминание не требуется.",
        );
      }
    }
  };

  const handleUserChanged = async (user: MobileSessionUser | null) => {
    setSessionUser(user);
    if (user) {
      const ops = await repo.getPendingOperations(user.id);
      setPendingOpsCount(ops.length);
      const progressList = await repo.getAllUserProgress(user.id);
      const map: Record<string, UserTaskProgress> = {};
      for (const p of progressList) {
        map[p.taskId] = p;
      }
      setTaskProgress(map);
      await loadTasks(selectedGroup, user);
    } else {
      setScheduledReminders({});
      setPendingOpsCount(0);
      setTaskProgress({});
      await loadTasks(selectedGroup, null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.logoAndBrand}>
          <Image
            source={require("../../assets/brand-mark.png")}
            style={styles.brandLogoImage}
            resizeMode="contain"
          />
          <View style={styles.brandTextGroup}>
            <Text style={styles.brandTitle}>
              Student Value <Text style={styles.brandCoefficient}>1.984</Text>
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => setGroupPickerVisible(true)}
            style={styles.groupPickerButton}
            accessibilityRole="button"
            accessibilityLabel={`Текущая группа: ${selectedGroup}. Нажмите для выбора.`}
          >
            <Text style={styles.groupPickerText}>
              {getGroupDisplayLabel(selectedGroup)}
            </Text>
            <Text style={styles.groupPickerArrow}>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAuthModalVisible(true)}
            style={styles.avatarButton}
            accessibilityRole="button"
            accessibilityLabel={
              sessionUser
                ? `Профиль: ${sessionUser.nickname}`
                : "Войти в аккаунт"
            }
          >
            {sessionUser ? (
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarText}>
                  {(sessionUser.nickname[0] || "U").toUpperCase()}
                </Text>
                {pendingOpsCount > 0 && <View style={styles.pendingDotBadge} />}
              </View>
            ) : (
              <View style={styles.loginPill}>
                <Text style={styles.loginPillText}>Войти</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Data status / age banner */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {sourceFetchedAt
            ? `Обновлено ${formatAge(sourceFetchedAt)}`
            : "Память устройства (офлайн)"}
          {isStale ? " · копия устарела" : ""}
        </Text>
      </View>

      {/* Sync / Offline Message Banner */}
      {syncMessage ? (
        <TouchableOpacity
          style={styles.syncMessageBanner}
          activeOpacity={0.7}
          onPress={() => {
            if (syncMessage.includes("404") || syncMessage.includes("недоступен")) {
              const target = apiOrigin.includes("127.0.0.1")
                ? "https://studentvalue1984.eu.cc"
                : "http://127.0.0.1:3000";
              handleSelectOrigin(target);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={syncMessage}
        >
          <Text style={styles.syncMessageText}>{syncMessage}</Text>
          {(syncMessage.includes("404") || syncMessage.includes("недоступен")) && (
            <Text style={styles.syncMessageHint}>
              Нажмите для переключения на {apiOrigin.includes("127.0.0.1") ? "Production (eu.cc)" : "127.0.0.1:3000"}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* 7-Day Switcher Strip */}
      <DaySwitcher
        days={days}
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d)}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        monthYearLabel={monthYearLabel}
        weekParity={academicWeek.parityLabel}
      />

      {/* Content Area */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleManualSync}
            tintColor="#93c5fd"
            colors={["#3378ff"]}
          />
        }
      >
        {viewMode === "flow" ? (
          <>
            {/* Flow Mode: Open hero composition */}
            <FlowHeroCard
              lesson={heroLesson}
              dateLabel={dateFullLabel}
              isToday={isSelectedToday}
              isLoaded={isLoaded}
              totalLessonsToday={lessons.length}
              allDoneToday={allDoneToday}
              nowMoscowMinutes={nowMoscowMin}
            />

            {/* Stage B & C: Protected Personal Progress, Materials and Reminders */}
            <View style={styles.taskSection}>
              <Text style={styles.sectionHeaderTitle}>Текущая работа и прогресс</Text>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TaskProgressCard
                    key={task.id}
                    taskId={task.id}
                    title={task.title}
                    subject={task.subject}
                    deadlineText={
                      task.deadlineMoscowStr
                        ? `Дедлайн: ${task.deadlineMoscowStr}`
                        : "Без установленного дедлайна"
                    }
                    progress={taskProgress[task.id] || null}
                    isLoggedIn={Boolean(sessionUser)}
                    materialId={task.materialId}
                    materialTitle={task.materialTitle}
                    reminderScheduled={Boolean(scheduledReminders[task.id])}
                    onToggleReminder={() => handleToggleReminderForTask(task)}
                    onOpenMaterial={(matId) => {
                      setActiveMaterialModalId(matId);
                      setMaterialModalVisible(true);
                    }}
                    onToggleStatus={handleToggleTaskStatus}
                    onOpenLogin={() => setAuthModalVisible(true)}
                    loading={updatingTaskId === task.id}
                  />
                ))
              ) : (
                <View style={styles.emptyTasksBox}>
                  <Text style={styles.emptyTasksText}>
                    В группе {selectedGroup} нет опубликованных заданий на текущий семестр.
                  </Text>
                </View>
              )}
            </View>

            {/* Upcoming today list */}
            {remainingLessons.length > 0 && (
              <View style={styles.upcomingSection}>
                <Text style={styles.upcomingHeader}>Далее сегодня</Text>
                {remainingLessons.map((l) => (
                  <View key={l.id} style={styles.upcomingItem}>
                    <View style={styles.upcomingTimeCol}>
                      <Text style={styles.upcomingTimeText}>{l.start}</Text>
                      <Text style={styles.upcomingEndTimeText}>{l.scheduledEnd}</Text>
                    </View>
                    <View style={styles.upcomingContentCol}>
                      <Text style={styles.upcomingSubjectText}>{l.subject}</Text>
                      <Text style={styles.upcomingDetailsText}>
                        {l.rooms.join(", ")} · {l.type}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Switch to Full Timetable View */}
            {lessons.length > 0 && (
              <TouchableOpacity
                onPress={() => setViewMode("full")}
                style={styles.toggleViewButton}
                accessibilityRole="button"
                accessibilityLabel="Показать полное расписание на день"
              >
                <Text style={styles.toggleViewText}>
                  Полное расписание дня ({lessons.length} пар) ↑
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Full Day Mode */}
            <TouchableOpacity
              onPress={() => setViewMode("flow")}
              style={styles.backToFlowButton}
              accessibilityRole="button"
              accessibilityLabel="Вернуться в режим Поток"
            >
              <Text style={styles.backToFlowText}>← Вернуться в Поток</Text>
            </TouchableOpacity>

            <FullDayLessonList
              lessons={lessons}
              isLoaded={isLoaded}
            />
          </>
        )}
      </ScrollView>

      {/* Group Picker Modal */}
      <GroupPickerModal
        visible={groupPickerVisible}
        selectedGroup={selectedGroup}
        onSelectGroup={handleSelectGroup}
        currentOrigin={apiOrigin}
        onSelectOrigin={handleSelectOrigin}
        onClose={() => setGroupPickerVisible(false)}
      />

      {/* Auth & Profile Modal (Stage B) */}
      <AuthModal
        visible={authModalVisible}
        user={sessionUser}
        pendingCount={pendingOpsCount}
        onClose={() => setAuthModalVisible(false)}
        onUserChanged={handleUserChanged}
        onFlushComplete={async () => {
          if (sessionUser) {
            const ops = await repo.getPendingOperations(sessionUser.id);
            setPendingOpsCount(ops.length);
            const progressList = await repo.getAllUserProgress(sessionUser.id);
            const map: Record<string, UserTaskProgress> = {};
            for (const p of progressList) {
              map[p.taskId] = p;
            }
            setTaskProgress(map);
          }
        }}
      />
      {/* Stage C: Course Material Offline Modal */}
      <MaterialModal
        visible={materialModalVisible}
        materialId={activeMaterialModalId}
        userId={sessionUser?.id ?? null}
        onClose={() => setMaterialModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b1424",
    paddingTop:
      Platform.OS === "android" ? (RNStatusBar.currentHeight || 28) + 4 : 0,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  logoAndBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandLogoImage: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  brandTextGroup: {
    flexDirection: "column",
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f0f4f8",
    letterSpacing: -0.3,
  },
  brandCoefficient: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  groupPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16253d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 40,
    gap: 6,
    borderWidth: 1,
    borderColor: "#223554",
  },
  groupPickerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#dbeafe",
  },
  groupPickerArrow: {
    fontSize: 9,
    color: "#8a9bb5",
  },
  syncButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#16253d",
  },
  syncIcon: {
    fontSize: 18,
    color: "#93c5fd",
    fontWeight: "bold",
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  statusText: {
    fontSize: 11,
    color: "#6b7d96",
  },
  syncMessageBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },
  syncMessageText: {
    fontSize: 12,
    color: "#93c5fd",
    textAlign: "center",
  },
  syncMessageHint: {
    fontSize: 11,
    color: "#a5b4fc",
    textAlign: "center",
    marginTop: 4,
    textDecorationLine: "underline",
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  upcomingSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  upcomingHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8a9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  upcomingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  upcomingTimeCol: {
    width: 60,
    marginRight: 12,
  },
  upcomingTimeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f0f4f8",
    fontFamily: "monospace",
  },
  upcomingEndTimeText: {
    fontSize: 11,
    color: "#8a9bb5",
    fontFamily: "monospace",
  },
  upcomingContentCol: {
    flex: 1,
  },
  upcomingSubjectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
    marginBottom: 2,
  },
  upcomingDetailsText: {
    fontSize: 12,
    color: "#8a9bb5",
  },
  toggleViewButton: {
    marginTop: 24,
    paddingVertical: 14,
    minHeight: 48,
    backgroundColor: "#16253d",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#223554",
  },
  toggleViewText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#93c5fd",
  },
  backToFlowButton: {
    paddingVertical: 12,
    minHeight: 44,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  backToFlowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#93c5fd",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  pendingDotBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fbbf24",
    borderWidth: 2,
    borderColor: "#0b1424",
  },
  loginPill: {
    backgroundColor: "rgba(147, 197, 253, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.25)",
  },
  loginPillText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
  },
  taskSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8a9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emptyTasksBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 4,
  },
  emptyTasksText: {
    fontSize: 13,
    color: "#8a9bb5",
    textAlign: "center",
  },
});
