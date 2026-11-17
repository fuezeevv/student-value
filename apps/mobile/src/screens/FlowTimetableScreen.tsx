import { focusScope } from "../focus/storage";
import { useNetInfo } from "@react-native-community/netinfo";
import { BrandMark, OfflineMark } from "../components/BrandMark";
import { ComparedSchedule } from "../components/ComparedSchedule";
import { showStudentScheduleSubject } from "@studentvalue/mobile-contracts";
import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import { useDaySwipe } from "../schedule/useDaySwipe";
import { logoutMobile } from "../auth/client";
import {
  sessionGeneration,
  invalidateSessionWork,
  isCurrentSession,
  sessionSignal,
} from "../auth/session-lifecycle";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
  Image,
  RefreshControl,
  Dimensions,
  Alert,
  AppState,
  TouchableOpacity,
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
  syncTeacherTimetableFromRuz,
  syncGroupTimetableFromRuzId,
  getActiveApiOrigin,
  setActiveApiOrigin,
} from "../api/client";
import {
  getSessionUser,
  getSessionToken,
  type MobileSessionUser,
} from "../auth/token-storage";
import { enqueueProgressUpdate, flushOutbox } from "../sync/outbox";
import { FlowHeroCard } from "../components/FlowHeroCard";
import { UpcomingLessonCard } from "../components/UpcomingLessonCard";
import { SchedulePickerModal } from "../components/SchedulePickerModal";
import { DaySwitcher } from "../components/DaySwitcher";
import { CampusMapModal } from "../components/CampusMapModal";
import { NewsModal } from "../components/NewsModal";
import { AuthModal } from "../components/AuthModal";
import { TaskProgressCard } from "../components/TaskProgressCard";
import { MaterialModal } from "../components/MaterialModal";
import { SubjectDetailModal } from "../components/SubjectDetailModal";
import { BottomNavBar, type NavTab } from "../components/BottomNavBar";
import { SubjectsTab } from "../components/tabs/SubjectsTab";
import { DeadlinesTab } from "../components/tabs/DeadlinesTab";
import { ProfileTab } from "../components/tabs/ProfileTab";
import { SpringPressable } from "../components/SpringPressable";
import { WellbeingModal } from "../components/WellbeingModal";
import { AppInfoModal } from "../components/AppInfoModal";
import { AmbientBottomGlow } from "../components/AmbientBottomGlow";
import { MapIcon, NewsIcon, ChevronDownIcon } from "../components/NativeIcons";
import {
  scheduleDeadlineReminder,
  activeReminderFlags,
  reconcileTaskReminders,
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

function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0, 10);
}

function addDaysTo(dateStr: string, count: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const next = new Date(d.getTime() + count * 86400000);
  return next.toISOString().slice(0, 10);
}

const RU_DAYS_FULL = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

const RU_MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const RU_MONTHS_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function getMonthYearLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${RU_MONTHS_NAMES[m - 1]} ${y}`;
}

function formatFlowDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayName = RU_DAYS_FULL[dt.getUTCDay()];
  const monthName = RU_MONTHS_GENITIVE[m - 1];
  return `${dayName}, ${d} ${monthName}`;
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

export const FlowTimetableScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const connection = useNetInfo();
  const isOffline = connection.isConnected === false;
  const styles = useThemedStyles(createStyles);

  const [activeTab, setActiveTab] = useState<NavTab>("flow");
  const [visitedTabs, setVisitedTabs] = useState<Record<NavTab, boolean>>({
    flow: true,
    subjects: false,
    deadlines: false,
    profile: false,
  });
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [selectedGroup, setSelectedGroup] = useState<string>("5130901/40102");
  const [scheduleType, setScheduleType] = useState<"group" | "teacher">(
    "group",
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(
    null,
  );
  const [selectedRuzGroupId, setSelectedRuzGroupId] = useState<number | null>(
    45591,
  );
  const [todayStr, setTodayStr] = useState<string>(() => getMoscowDateString());
  const [nowMoscowMin, setNowMoscowMin] = useState<number>(() =>
    getMoscowNowMinutes(),
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getMoscowDateString(),
  );

  // Storage states
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [lessons, setLessons] = useState<MobileLesson[]>([]);
  const [weekLessons, setWeekLessons] = useState<MobileLesson[]>([]);
  const [daysWithLessons, setDaysWithLessons] = useState<
    Record<string, boolean>
  >({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sourceFetchedAt, setSourceFetchedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [apiOrigin, setApiOrigin] = useState<string>(
    "https://studentvalue1984.eu.cc",
  );

  // Auth and task progress states
  const [sessionUser, setSessionUser] = useState<MobileSessionUser | null>(
    null,
  );
  const [taskProgress, setTaskProgress] = useState<
    Record<string, UserTaskProgress>
  >({});
  const hasSelectedMembership = Boolean(
    sessionUser?.groups?.some((group) => group.code === selectedGroup),
  );
  const readOnlyReason =
    sessionUser && !hasSelectedMembership
      ? "Общие работы доступны для просмотра. Личные отметки и напоминания — в вашей группе."
      : undefined;
  const [pendingOpsCount, setPendingOpsCount] = useState<number>(0);
  const [tasks, setTasks] = useState<CachedTask[]>([]);
  const [scheduledReminders, setScheduledReminders] = useState<
    Record<string, boolean>
  >({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Modals
  const [schedulePickerVisible, setSchedulePickerVisible] =
    useState<boolean>(false);
  const [mapModalVisible, setMapModalVisible] = useState<boolean>(false);
  const [newsModalVisible, setNewsModalVisible] = useState<boolean>(false);
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [wellbeingModalVisible, setWellbeingModalVisible] =
    useState<boolean>(false);
  const [appInfoModalVisible, setAppInfoModalVisible] =
    useState<boolean>(false);
  const [focusPercent, setFocusPercent] = useState<number>(0);
  const [materialModalVisible, setMaterialModalVisible] =
    useState<boolean>(false);
  const [activeMaterialModalId, setActiveMaterialModalId] = useState<
    string | null
  >(null);
  const [subjectModalVisible, setSubjectModalVisible] =
    useState<boolean>(false);
  const [selectedLessonForModal, setSelectedLessonForModal] =
    useState<MobileLesson | null>(null);
  const [selectedSubjectTitle, setSelectedSubjectTitle] = useState<
    string | null
  >(null);

  const repo = useMemo(() => getTimetableRepository(), []);
  const taskReqGenRef = useRef(0);
  const [taskLoadMessage, setTaskLoadMessage] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);
  const reqGenRef = useRef(0);

  const handleSelectTab = useCallback((t: NavTab) => {
    setActiveTab(t);
    setVisitedTabs((prev) => (prev[t] ? prev : { ...prev, [t]: true }));
  }, []);

  const handleOpenLesson = useCallback((l: MobileLesson) => {
    setSelectedSubjectTitle(null);
    setSelectedLessonForModal(l);
    setSubjectModalVisible(true);
  }, []);

  const handleOpenMaterial = useCallback((matId: string) => {
    setActiveMaterialModalId(matId);
    setMaterialModalVisible(true);
  }, []);

  const handleOpenLogin = useCallback(() => {
    setAuthModalVisible(true);
  }, []);

  const handleOpenGroupPicker = useCallback(() => {
    setSchedulePickerVisible(true);
  }, []);

  // Load API origin and notification channels
  useEffect(() => {
    getActiveApiOrigin().then(setApiOrigin);
    setupNotificationChannels().catch(() => {});
  }, []);

  const loadTasks = useCallback(
    async (groupCode: string, user: MobileSessionUser | null) => {
      const generation = sessionGeneration();
      const requestId = ++taskReqGenRef.current;
      const current = () =>
        isCurrentSession(generation) && requestId === taskReqGenRef.current;
      if (!/^\d{7}\/\d{5}(?:_\d{4})?$/.test(groupCode)) {
        setTasks([]);
        setTaskLoadMessage("Для просмотра заданий выберите учебную группу.");
        return;
      }
      setTaskLoadMessage("Обновляем задания…");
      const cacheOrigin = await getActiveApiOrigin();
      let previousTasks: CachedTask[] = [];
      try {
        const cached = await repo.getCachedTasksForGroup(
          groupCode,
          user?.id,
          cacheOrigin,
        );
        previousTasks = cached;
        if (current()) setTasks(cached);
        if (user) {
          const flags = await activeReminderFlags(user.id, cached).catch(
            () => ({}),
          );
          if (current()) setScheduledReminders(flags);
        }
      } catch (err) {
        console.warn("Could not read cached tasks from SQLite:", err);
      }

      const controller = new AbortController();
      const parentSignal = sessionSignal();
      const abort = () => controller.abort();
      parentSignal.addEventListener("abort", abort);
      const timer = setTimeout(abort, 8000);
      try {
        const origin = await getActiveApiOrigin();
        const token = await getSessionToken();
        const headers: Record<string, string> = {};
        if (token && user) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(
          `${origin}/api/v1/tasks?group=${encodeURIComponent(groupCode)}`,
          { headers, signal: controller.signal },
        );
        if (!res.ok)
          throw new Error(
            res.status === 404
              ? "Список заданий недоступен на выбранном сервере. Проверьте его на сайте."
              : "Не удалось обновить задания. Показываем сохранённую копию, если она есть.",
          );
        if (res.ok) {
          const data = await res.json();
          if (current()) setTaskLoadMessage(null);
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
          if (!current()) return;
          await repo.saveCachedTasksForGroup(
            groupCode,
            mapped,
            user?.id,
            cacheOrigin,
          );
          if (!current()) return;
          setTasks(mapped);

          if (user) {
            const progressMap: Record<string, UserTaskProgress> = {};
            const pendingTasks = new Set(
              (await repo.getPendingOperations(user.id)).map(
                (operation) => operation.taskId,
              ),
            );
            for (const st of serverTasks) {
              if (!current()) return;
              if (pendingTasks.has(st.id)) {
                const draft = await repo.getUserProgress(user.id, st.id);
                if (draft) progressMap[st.id] = draft;
                continue;
              }
              if (st.progress) {
                progressMap[st.id] = {
                  userId: user.id,
                  taskId: st.id,
                  status: st.progress.status,
                  isVerified: st.progress.isVerified,
                  studentNotes: st.progress.studentNotes,
                  syncState: "SYNCED",
                  completedAt: st.progress.completedAt,
                  updatedAt: st.progress.updatedAt,
                };
                await repo.saveUserProgress(progressMap[st.id]);
              } else {
                await repo.deleteUserProgress(user.id, st.id);
              }
            }
            if (!current()) return;
            setTaskProgress((previous) => {
              const next = { ...previous };
              for (const task of serverTasks) delete next[task.id];
              return { ...next, ...progressMap };
            });
            await reconcileTaskReminders(
              user.id,
              previousTasks,
              mapped,
              new Set(
                Object.values(progressMap)
                  .filter((progress) =>
                    ["READY", "SUBMITTED", "ACCEPTED"].includes(
                      progress.status,
                    ),
                  )
                  .map((progress) => progress.taskId),
              ),
            ).catch(() => {});
            const flags = await activeReminderFlags(user.id, mapped).catch(
              () => ({}),
            );
            if (current()) setScheduledReminders(flags);
          }
        }
      } catch (err) {
        if (current())
          setTaskLoadMessage(
            err instanceof Error && err.name !== "AbortError"
              ? err.message
              : "Не удалось обновить задания. Сохранённая копия может быть устаревшей.",
          );
      } finally {
        clearTimeout(timer);
        parentSignal.removeEventListener("abort", abort);
      }
    },
    [repo],
  );

  // Cold start directly from SQLite repository
  const loadFromSqlite = useCallback(async () => {
    const generation = reqGenRef.current;
    try {
      const res = await repo.getDayTimetable(selectedGroup, selectedDate);
      if (generation !== reqGenRef.current) return;
      if (res.status === "loaded") {
        setIsLoaded(true);
        setLessons(
          res.lessons.filter((l) => showStudentScheduleSubject(l.subject)),
        );
        setSavedAt(res.savedAt);
        setSourceFetchedAt(res.sourceFetchedAt);
        setIsStale(
          res.isStale ||
            Date.now() - Date.parse(res.sourceFetchedAt) > 15 * 60 * 1000,
        );
      } else {
        setIsLoaded(false);
        setLessons([]);
        setSavedAt(null);
        setSourceFetchedAt(null);
      }

      const weekStart = weekStartFor(selectedDate);
      const stored = await repo.getSnapshot(selectedGroup, weekStart);
      if (generation !== reqGenRef.current) return;
      setWeekLessons([]);
      setDaysWithLessons({});
      if (stored?.snapshot?.data?.days) {
        const allWkLessons = stored.snapshot.data.days.flatMap(
          (d: { lessons: MobileLesson[] }) => d.lessons,
        );
        setWeekLessons(
          allWkLessons.filter((l) => showStudentScheduleSubject(l.subject)),
        );
        setDaysWithLessons(
          Object.fromEntries(
            stored.snapshot.data.days.map((day) => [
              day.date,
              day.lessons.some((l) => showStudentScheduleSubject(l.subject)),
            ]),
          ),
        );
      }
    } catch {
      if (generation !== reqGenRef.current) return;
      setIsLoaded(false);
      setLessons([]);
      setWeekLessons([]);
    }
  }, [repo, selectedGroup, selectedDate]);

  // Ignore completions from the previous account or group selection.
  useEffect(() => {
    let active = true;
    const generation = sessionGeneration();
    void (async () => {
      try {
        const u = await getSessionUser();
        if (!active || !isCurrentSession(generation)) return;
        setSessionUser(u);
        if (u) {
          const ops = await repo.getPendingOperations(u.id);
          const progressList = await repo.getAllUserProgress(u.id);
          if (!active || !isCurrentSession(generation)) return;
          setPendingOpsCount(ops.length);
          setTaskProgress(
            Object.fromEntries(progressList.map((p) => [p.taskId, p])),
          );
          void flushOutbox().catch(() => {});
        }
        await loadTasks(selectedGroup, u);
      } catch {
        if (active)
          setTaskLoadMessage(
            "Не удалось прочитать личные данные с устройства. Повторите вход.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [repo, selectedGroup, loadTasks]);

  // Best-effort delivery while the app is active. No background-service claim:
  // OS suspension can pause this timer; foreground return also retries the queue.
  useEffect(() => {
    let active = true;
    const retry = async () => {
      if (AppState.currentState !== "active") return;
      const generation = sessionGeneration();
      const user = await getSessionUser();
      if (!user) return;
      await flushOutbox();
      if (!active || !isCurrentSession(generation)) return;
      const pending = await repo.getPendingOperations(user.id);
      const progress = await repo.getAllUserProgress(user.id);
      if (!active || !isCurrentSession(generation)) return;
      setPendingOpsCount(pending.length);
      setTaskProgress(Object.fromEntries(progress.map((p) => [p.taskId, p])));
    };
    const timer = setInterval(() => {
      void retry().catch(() => {});
    }, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void retry().catch(() => {});
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [repo]);

  // Load timetable on date/group change
  useEffect(() => {
    const currentGen = ++reqGenRef.current;
    loadFromSqlite().then(() => {
      if (currentGen !== reqGenRef.current) return;
      setIsSyncing(true);
      const syncPromise =
        scheduleType === "teacher" && selectedTeacherId
          ? syncTeacherTimetableFromRuz(
              selectedTeacherId,
              selectedGroup,
              selectedDate,
            )
          : selectedRuzGroupId &&
              selectedRuzGroupId !== 45591 &&
              !selectedGroup.startsWith("5130901/40102")
            ? syncGroupTimetableFromRuzId(
                selectedRuzGroupId,
                selectedGroup,
                selectedDate,
              )
            : syncTimetableFromApi(selectedGroup, selectedDate);

      syncPromise.then((result) => {
        if (currentGen !== reqGenRef.current) return;
        setIsSyncing(false);
        if (result.success) {
          setSyncMessage(null);
          loadFromSqlite();
        } else {
          setSyncMessage(result.message);
        }
      });
    });
  }, [
    loadFromSqlite,
    selectedGroup,
    selectedDate,
    scheduleType,
    selectedTeacherId,
    selectedRuzGroupId,
  ]);

  // Live timer for clock and midnight rollover
  useEffect(() => {
    const updateTime = () => {
      const newToday = getMoscowDateString();
      const newMin = getMoscowNowMinutes();
      setNowMoscowMin(newMin);
      setTodayStr((prevToday) => {
        if (prevToday !== newToday) {
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

  // Restore group and schedule preferences
  useEffect(() => {
    Promise.all([
      repo.getPreference("selected_group_code"),
      repo.getPreference("selected_schedule_type"),
      repo.getPreference("selected_teacher_id"),
      repo.getPreference("selected_ruz_group_id"),
    ]).then(([savedGroup, savedType, savedTeacherId, savedRuzId]) => {
      if (savedGroup) {
        setSelectedGroup(savedGroup);
      }
      if (savedType === "teacher" && savedTeacherId) {
        setScheduleType("teacher");
        setSelectedTeacherId(Number(savedTeacherId));
      } else if (savedRuzId) {
        setSelectedRuzGroupId(Number(savedRuzId));
      }
    });
  }, [repo]);

  // Manual refresh trigger
  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    let result;
    if (scheduleType === "teacher" && selectedTeacherId) {
      result = await syncTeacherTimetableFromRuz(
        selectedTeacherId,
        selectedGroup,
        selectedDate,
      );
    } else if (
      selectedRuzGroupId &&
      selectedRuzGroupId !== 45591 &&
      !selectedGroup.startsWith("5130901/40102")
    ) {
      result = await syncGroupTimetableFromRuzId(
        selectedRuzGroupId,
        selectedGroup,
        selectedDate,
      );
    } else {
      result = await syncTimetableFromApi(selectedGroup, selectedDate);
    }

    setIsSyncing(false);

    if (result.success) {
      setSyncMessage(null);
      await loadFromSqlite();
    } else {
      setSyncMessage(result.message);
      await loadFromSqlite();
    }

    const u = await getSessionUser();
    await loadTasks(selectedGroup, u);
  };

  const handleSelectGroup = (code: string, ruzId?: number) => {
    setSelectedGroup(code);
    setScheduleType("group");
    setSelectedTeacherId(null);
    setSelectedRuzGroupId(ruzId || null);
    repo.setPreference("selected_group_code", code);
    repo.setPreference("selected_schedule_type", "group");
    if (ruzId) {
      repo.setPreference("selected_ruz_group_id", String(ruzId));
    }
    setSchedulePickerVisible(false);
  };

  const handleSelectTeacher = (teacherId: number, teacherName: string) => {
    setSelectedGroup(teacherName);
    setScheduleType("teacher");
    setSelectedTeacherId(teacherId);
    setSelectedRuzGroupId(null);
    repo.setPreference("selected_group_code", teacherName);
    repo.setPreference("selected_schedule_type", "teacher");
    repo.setPreference("selected_teacher_id", String(teacherId));
    setSchedulePickerVisible(false);
  };

  const handleSelectOrigin = async (newOrigin: string) => {
    if (newOrigin === apiOrigin) return;
    invalidateSessionWork();
    // Never send a production bearer token to a development server.
    if (sessionUser) await logoutMobile();
    setSessionUser(null);
    setTaskProgress({});
    setTasks([]);
    setPendingOpsCount(0);
    setApiOrigin(newOrigin);
    await setActiveApiOrigin(newOrigin);
    setSchedulePickerVisible(false);
    setIsSyncing(true);
    setSyncMessage(null);
    const result = await syncTimetableFromApi(
      selectedGroup,
      selectedDate,
      newOrigin,
    );
    setIsSyncing(false);
    if (result.success) {
      setSyncMessage(null);
      await loadFromSqlite();
    } else {
      setSyncMessage(result.message);
      await loadFromSqlite();
    }
  };

  const handlePrevDay = useCallback(() => {
    setSelectedDate((prev) => addDaysTo(prev, -1));
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDate((prev) => addDaysTo(prev, 1));
  }, []);

  const daySwipe = useDaySwipe(handlePrevDay, handleNextDay);

  const handlePrevWeek = useCallback(() => {
    setSelectedDate((prev) => addDaysTo(prev, -7));
  }, []);

  const handleNextWeek = useCallback(() => {
    setSelectedDate((prev) => addDaysTo(prev, 7));
  }, []);

  const handleResetToday = useCallback(() => {
    setSelectedDate(todayStr);
  }, [todayStr]);

  const monthYearLabel = useMemo(() => {
    return getMonthYearLabel(selectedDate);
  }, [selectedDate]);

  const weekParityLabel = useMemo(() => {
    const weekStart = weekStartFor(selectedDate);
    const start = new Date(weekStart + "T12:00:00Z");
    const semStart = new Date("2026-09-01T12:00:00Z");
    const semStartMonday = new Date(
      semStart.getTime() - ((semStart.getUTCDay() + 6) % 7) * 86400000,
    );
    const diffWeeks = Math.max(
      1,
      Math.floor(
        (start.getTime() - semStartMonday.getTime()) / (7 * 86400000),
      ) + 1,
    );
    const isEven = diffWeeks % 2 === 0;
    return `${diffWeeks}-я неделя · ${isEven ? "Чётная" : "Нечётная"}`;
  }, [selectedDate]);

  const daySwitcherDays = useMemo(() => {
    const weekStart = weekStartFor(selectedDate);
    const labels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
    return Array.from({ length: 7 }, (_, i) => {
      const dStr = addDaysTo(weekStart, i);
      const dayNum = String(parseInt(dStr.slice(8), 10));
      const isToday = dStr === todayStr;
      return {
        date: dStr,
        dayNumber: dayNum,
        dayLabel: labels[i],
        isToday,
        hasLessons: Boolean(daysWithLessons[dStr]),
      };
    });
  }, [selectedDate, todayStr, daysWithLessons]);

  // Task self-completion toggle
  const handleToggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      if (!sessionUser) {
        setAuthModalVisible(true);
        return;
      }

      if (!sessionUser.groups?.some((group) => group.code === selectedGroup)) {
        Alert.alert(
          "Просмотр другой группы",
          "Личные отметки доступны только в группе, в которой вы состоите.",
        );
        return;
      }
      setUpdatingTaskId(taskId);
      const nextStatus: "READY" | "NOT_STARTED" =
        currentStatus === "READY" || currentStatus === "SUBMITTED"
          ? "NOT_STARTED"
          : "READY";

      try {
        const cur = taskProgress[taskId];
        const { optimisticProgress } = await enqueueProgressUpdate(
          taskId,
          nextStatus,
          cur?.studentNotes ?? undefined,
          tasks.find((task) => task.id === taskId)?.groupCode,
        );

        setTaskProgress((prev) => ({ ...prev, [taskId]: optimisticProgress }));

        const ops = await repo.getPendingOperations(sessionUser.id);
        setPendingOpsCount(ops.length);

        const targetTask = tasks.find((t) => t.id === taskId);
        if (targetTask?.deadlineId && targetTask.deadlineDate) {
          if (nextStatus === "READY") {
            await cancelDeadlineReminder(
              sessionUser.id,
              taskId,
              targetTask.deadlineId,
            );
            setScheduledReminders((prev) => ({ ...prev, [taskId]: false }));
          }
        }

        flushOutbox().then(async () => {
          const freshOps = await repo.getPendingOperations(sessionUser.id);
          setPendingOpsCount(freshOps.length);
        });
      } catch (err) {
        console.error("Error toggling task progress:", err);
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [sessionUser, taskProgress, repo, tasks, selectedGroup],
  );

  // Toggle reminder for task
  const handleToggleReminderForTask = useCallback(
    async (task: CachedTask) => {
      try {
        if (!sessionUser) {
          setAuthModalVisible(true);
          return;
        }
        if (
          !sessionUser.groups?.some((group) => group.code === task.groupCode)
        ) {
          Alert.alert(
            "Просмотр другой группы",
            "Личные напоминания доступны только участникам этой группы.",
          );
          return;
        }
        if (!task.deadlineId || !task.deadlineDate) {
          Alert.alert(
            "Дедлайн не найден",
            "У этого задания нет подтверждённого срока.",
          );
          return;
        }

        const isCurrentScheduled = Boolean(scheduledReminders[task.id]);

        if (isCurrentScheduled) {
          await cancelDeadlineReminder(
            sessionUser.id,
            task.id,
            task.deadlineId,
          );
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
              `Напоминание: ${new Date(scheduled.triggerTime).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК.`,
            );
          } else {
            Alert.alert(
              "Не удалось установить напоминание",
              "Проверьте разрешение уведомлений и актуальность подтверждённого срока.",
            );
          }
        }
      } catch {
        Alert.alert(
          "Напоминание не сохранено",
          "Проверьте разрешение уведомлений в настройках Android и повторите попытку.",
        );
      }
    },
    [sessionUser, scheduledReminders],
  );

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
    } else {
      setPendingOpsCount(0);
      setTaskProgress({});
    }
    await loadTasks(selectedGroup, user);
  };

  const handleLogout = async () => {
    try {
      await logoutMobile();
    } catch {
      Alert.alert(
        "Выход",
        "Сессия завершена, но не все локальные файлы удалось удалить. Повторите очистку на устройстве.",
      );
    } finally {
      setTasks([]);
      setSessionUser(null);
      setTaskProgress({});
      setPendingOpsCount(0);
      setScheduledReminders({});
      await loadTasks(selectedGroup, null);
    }
  };

  // Determine current hero lesson
  const isSelectedToday = selectedDate === todayStr;
  const parseMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const heroLesson = useMemo(() => {
    if (lessons.length === 0) return null;
    if (!isSelectedToday) return lessons[0];

    const ongoing = lessons.find((l) => {
      const s = parseMin(l.start);
      const e = s + 90;
      return nowMoscowMin >= s && nowMoscowMin < e;
    });
    if (ongoing) return ongoing;

    const upcoming = lessons.find((l) => parseMin(l.start) > nowMoscowMin);
    if (upcoming) return upcoming;

    return lessons[lessons.length - 1];
  }, [lessons, isSelectedToday, nowMoscowMin]);

  const allDoneToday = useMemo(() => {
    if (lessons.length === 0 || !isSelectedToday) return false;
    const last = lessons[lessons.length - 1];
    return nowMoscowMin >= parseMin(last.start) + 90;
  }, [lessons, isSelectedToday, nowMoscowMin]);

  const remainingLessons = useMemo(() => {
    if (!heroLesson) return [];
    return lessons.filter((l) => l.id !== heroLesson.id);
  }, [lessons, heroLesson]);

  const dateFullLabel = useMemo(() => {
    return formatFlowDate(selectedDate);
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Top Header - clean, minimal, camera notch protected */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.logoButton}
          onPress={() => {
            if (activeTab === "flow") {
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }
            setAppInfoModalVisible(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="О приложении и статус сети"
        >
          <BrandMark size={34} />
        </TouchableOpacity>

        {/* Schedule Selector Chip (current group or teacher) */}
        <TouchableOpacity
          style={styles.headerScheduleChip}
          onPress={() => setSchedulePickerVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Расписание: ${selectedGroup}. Нажмите для смены группы или преподавателя.`}
        >
          <Text style={styles.headerScheduleText} numberOfLines={1}>
            {selectedGroup}
          </Text>
          <ChevronDownIcon size={12} color={colors.link} />
        </TouchableOpacity>

        {/* Right header actions: Campus Map, News, Wellbeing badge */}
        <View style={styles.topHeaderRight}>
          {isOffline ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Нет подключения к сети. Сохранённые данные: ${formatAge(sourceFetchedAt)}`}
              onPress={() => setAppInfoModalVisible(true)}
              style={styles.headerIconBtn}
            >
              <OfflineMark color={colors.muted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setMapModalVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Карта кампуса СПбПУ"
          >
            <MapIcon size={18} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setNewsModalVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Новости и анонсы"
          >
            <NewsIcon size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Circular Wellbeing / Focus Badge (matches '0' in user's design) */}
          <TouchableOpacity
            onPress={() => setWellbeingModalVisible(true)}
            style={[
              styles.wellbeingBadge,
              focusPercent >= 100 && styles.wellbeingBadgeCompleted,
              focusPercent > 0 &&
                focusPercent < 100 &&
                styles.wellbeingBadgeActive,
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Сегодня в своём темпе: ${focusPercent}% выполнено. Нажмите для открытия.`}
          >
            <Text
              style={[
                styles.wellbeingText,
                focusPercent >= 100 && styles.wellbeingTextCompleted,
                focusPercent > 0 && styles.wellbeingTextActive,
              ]}
            >
              {focusPercent}
            </Text>
            {pendingOpsCount > 0 && <View style={styles.pendingDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Screen View with Retained Tabs */}
      <View
        style={styles.bodyContainer}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 200 && height !== containerHeight) {
            setContainerHeight(height);
          }
        }}
      >
        {/* Tab 1: Flow */}
        <View
          style={[styles.tabPane, activeTab !== "flow" && styles.hiddenPane]}
          pointerEvents={activeTab === "flow" ? "auto" : "none"}
        >
          <ScrollView
            {...daySwipe.panHandlers}
            ref={scrollRef}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            snapToOffsets={
              containerHeight > 0 ? [0, containerHeight] : undefined
            }
            snapToEnd={false}
            decelerationRate="fast"
            refreshControl={
              <RefreshControl
                refreshing={isSyncing}
                onRefresh={handleManualSync}
                tintColor={colors.link}
                colors={["#3378ff"]}
              />
            }
          >
            {/* Page 1: Immersive Fullscreen Hero */}
            <FlowHeroCard
              lesson={heroLesson}
              groupCode={selectedGroup}
              dateLabel={dateFullLabel}
              isToday={isSelectedToday}
              isLoaded={isLoaded}
              totalLessonsToday={lessons.length}
              allDoneToday={allDoneToday}
              nowMoscowMinutes={nowMoscowMin}
              containerHeight={containerHeight}
              onSelectGroup={() => setSchedulePickerVisible(true)}
              onOpenSubject={handleOpenLesson}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              onResetToday={handleResetToday}
              onScrollCuePress={() => {
                const targetY = containerHeight > 0 ? containerHeight : 560;
                scrollRef.current?.scrollTo({
                  y: targetY,
                  animated: true,
                });
              }}
            />

            {/* Page 2: Full Screen "Далее сегодня" + Дедлайны */}
            <View
              style={[
                styles.page2Container,
                containerHeight > 0
                  ? { minHeight: containerHeight }
                  : undefined,
              ]}
            >
              {/* Day & Week Switcher at top of schedule view */}
              <DaySwitcher
                days={daySwitcherDays}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPrevDay={handlePrevDay}
                onNextDay={handleNextDay}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
                onResetToday={handleResetToday}
                monthYearLabel={monthYearLabel}
                weekParity={weekParityLabel}
                isTodaySelected={selectedDate === todayStr}
              />
              <ComparedSchedule
                date={selectedDate}
                primaryLabel={selectedGroup}
                primaryLessons={lessons}
                loaded={isLoaded}
              />

              {/* Deadlines and Tasks section */}
              <View style={styles.tasksSection}>
                <Text style={styles.sectionHeaderTitle}>
                  Текущая работа и дедлайны
                </Text>
                {taskLoadMessage && (
                  <Text style={styles.emptyTasksText}>{taskLoadMessage}</Text>
                )}
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
                      isLoggedIn={Boolean(sessionUser) && hasSelectedMembership}
                      readOnlyReason={readOnlyReason}
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
                      {taskLoadMessage
                        ? "Задания пока не удалось показать. Это не означает, что их не задавали."
                        : "В доступных данных группы пока нет опубликованных заданий. Это не означает, что заданий нет."}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Tab 2: Subjects */}
        <View
          style={[
            styles.tabPane,
            activeTab !== "subjects" && styles.hiddenPane,
          ]}
          pointerEvents={activeTab === "subjects" ? "auto" : "none"}
        >
          {visitedTabs.subjects && (
            <SubjectsTab
              lessons={weekLessons.length > 0 ? weekLessons : lessons}
              tasks={tasks}
              groupCode={selectedGroup}
              onOpenLesson={handleOpenLesson}
              onOpenSubjectTasks={(subject) => {
                setSelectedLessonForModal(null);
                setSelectedSubjectTitle(subject);
                setSubjectModalVisible(true);
              }}
            />
          )}
        </View>

        {/* Tab 3: Deadlines */}
        <View
          style={[
            styles.tabPane,
            activeTab !== "deadlines" && styles.hiddenPane,
          ]}
          pointerEvents={activeTab === "deadlines" ? "auto" : "none"}
        >
          {visitedTabs.deadlines && (
            <DeadlinesTab
              tasks={tasks}
              taskProgress={taskProgress}
              groupCode={selectedGroup}
              statusMessage={taskLoadMessage}
              isLoggedIn={Boolean(sessionUser) && hasSelectedMembership}
              readOnlyReason={readOnlyReason}
              scheduledReminders={scheduledReminders}
              updatingTaskId={updatingTaskId}
              onToggleStatus={handleToggleTaskStatus}
              onToggleReminder={handleToggleReminderForTask}
              onOpenMaterial={handleOpenMaterial}
              onOpenLogin={handleOpenLogin}
            />
          )}
        </View>

        {/* Tab 4: Profile */}
        <View
          style={[styles.tabPane, activeTab !== "profile" && styles.hiddenPane]}
          pointerEvents={activeTab === "profile" ? "auto" : "none"}
        >
          {visitedTabs.profile && (
            <ProfileTab
              sessionUser={sessionUser}
              groupCode={selectedGroup}
              cachedLessonsCount={lessons.length}
              cachedTasksCount={tasks.length}
              apiOrigin={apiOrigin}
              isStale={isStale}
              onOpenGroupPicker={() => setSchedulePickerVisible(true)}
              onOpenCampusMap={() => setMapModalVisible(true)}
              onOpenNews={() => setNewsModalVisible(true)}
              onOpenLogin={handleOpenLogin}
              onLogout={handleLogout}
              onSelectOrigin={handleSelectOrigin}
              onRefreshData={handleManualSync}
            />
          )}
        </View>
      </View>

      {/* Ambient bottom reflection glow */}
      <AmbientBottomGlow />

      {/* Persistent Bottom Navigation Bar */}
      <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Schedule Picker Modal (Groups, Teachers, Favorites) */}
      <SchedulePickerModal
        visible={schedulePickerVisible}
        selectedSchedule={selectedGroup}
        onSelectGroup={handleSelectGroup}
        onSelectTeacher={handleSelectTeacher}
        currentOrigin={apiOrigin}
        onSelectOrigin={handleSelectOrigin}
        onClose={() => setSchedulePickerVisible(false)}
      />

      {/* Campus Map Modal */}
      <CampusMapModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
      />

      {/* University News Modal */}
      <NewsModal
        visible={newsModalVisible}
        onClose={() => setNewsModalVisible(false)}
      />

      {/* Subject Detail Modal */}
      <SubjectDetailModal
        visible={subjectModalVisible}
        lesson={selectedLessonForModal}
        subject={selectedSubjectTitle}
        tasks={tasks}
        onClose={() => {
          setSubjectModalVisible(false);
          setSelectedLessonForModal(null);
        }}
        onOpenMaterial={(matId) => {
          setSubjectModalVisible(false);
          setActiveMaterialModalId(matId);
          setMaterialModalVisible(true);
        }}
      />

      {/* Auth Modal */}
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

      {/* Material Modal */}
      <MaterialModal
        visible={materialModalVisible}
        materialId={activeMaterialModalId}
        userId={sessionUser?.id ?? null}
        onClose={() => {
          setMaterialModalVisible(false);
          setActiveMaterialModalId(null);
        }}
      />

      {/* App Info & Connectivity Modal (opened by Logo) */}
      <AppInfoModal
        visible={appInfoModalVisible}
        groupCode={selectedGroup}
        isSyncing={isSyncing}
        isOffline={connection.isConnected === null ? undefined : isOffline}
        isStale={isStale}
        apiOrigin={apiOrigin}
        cachedAgeLabel={formatAge(savedAt || sourceFetchedAt)}
        onClose={() => setAppInfoModalVisible(false)}
        onRefresh={() => {
          setAppInfoModalVisible(false);
          handleManualSync();
        }}
        onOpenGroupPicker={() => {
          setAppInfoModalVisible(false);
          setSchedulePickerVisible(true);
        }}
        onSelectOrigin={handleSelectOrigin}
      />

      {/* Wellbeing & Focus Modal (opened by Circle with 0) */}
      <WellbeingModal
        key={focusScope(apiOrigin, sessionUser?.id)}
        storageScope={focusScope(apiOrigin, sessionUser?.id)}
        visible={wellbeingModalVisible}
        tasks={tasks}
        onClose={() => setWellbeingModalVisible(false)}
        onFocusPercentChange={setFocusPercent}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.canvas,
      paddingTop:
        Platform.OS === "android" ? (RNStatusBar.currentHeight || 28) + 4 : 0,
    },
    topHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.canvas,
    },
    logoButton: {
      padding: 4,
    },
    brandLogoImage: {
      width: 34,
      height: 34,
      borderRadius: 8,
    },
    headerScheduleChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.soft,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      maxWidth: 165,
    },
    headerScheduleText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
      fontFamily: "monospace",
    },
    topHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.soft,
      position: "relative",
    },
    newsIndicatorDot: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.link,
    },
    wellbeingBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1.5,
      borderColor: "rgba(255, 255, 255, 0.2)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.soft,
      position: "relative",
    },
    wellbeingText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.muted,
    },
    wellbeingBadgeActive: {
      borderColor: colors.link,
      backgroundColor: "rgba(59, 130, 246, 0.15)",
    },
    wellbeingBadgeCompleted: {
      borderColor: "#10b981",
      backgroundColor: "rgba(16, 185, 129, 0.2)",
    },
    wellbeingTextActive: {
      color: colors.link,
    },
    wellbeingTextCompleted: {
      color: colors.success,
    },
    pendingDot: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: "#f59e0b",
    },
    bodyContainer: {
      flex: 1,
    },
    tabPane: {
      flex: 1,
    },
    hiddenPane: {
      display: "none",
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    page2Container: {
      paddingTop: 8,
    },
    page2HeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    backToHeroButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: "rgba(51, 120, 255, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(96, 165, 250, 0.2)",
    },
    backToHeroText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.link,
    },
    upcomingSection: {
      paddingHorizontal: 20,
      marginTop: 12,
      marginBottom: 20,
    },
    sectionHeaderTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.subtle,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    tasksSection: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    emptyTasksBox: {
      backgroundColor: colors.soft,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.line,
    },
    emptyTasksText: {
      fontSize: 13,
      color: colors.subtle,
      textAlign: "center",
      lineHeight: 18,
    },
  });
