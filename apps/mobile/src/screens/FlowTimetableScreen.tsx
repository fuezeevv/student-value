import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { FlowHeroCard } from "../components/FlowHeroCard";
import { UpcomingLessonCard } from "../components/UpcomingLessonCard";
import { GroupPickerModal } from "../components/GroupPickerModal";
import { AuthModal } from "../components/AuthModal";
import { TaskProgressCard } from "../components/TaskProgressCard";
import { MaterialModal } from "../components/MaterialModal";
import { SubjectDetailModal } from "../components/SubjectDetailModal";
import { BottomNavBar, type NavTab } from "../components/BottomNavBar";
import { SubjectsTab } from "../components/tabs/SubjectsTab";
import { DeadlinesTab } from "../components/tabs/DeadlinesTab";
import { ProfileTab } from "../components/tabs/ProfileTab";
import { SpringPressable } from "../components/SpringPressable";
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

function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0, 10);
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

function formatFlowDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayName = RU_DAYS_FULL[dt.getUTCDay()];
  const monthName = RU_MONTHS_GENITIVE[m - 1];
  return `${dayName}, ${d} ${monthName}`;
}

export const FlowTimetableScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>("flow");
  const [selectedGroup, setSelectedGroup] = useState<string>("5130901/40102");
  const [todayStr, setTodayStr] = useState<string>(() => getMoscowDateString());
  const [nowMoscowMin, setNowMoscowMin] = useState<number>(() => getMoscowNowMinutes());
  const [selectedDate, setSelectedDate] = useState<string>(() => getMoscowDateString());

  // Storage states
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [lessons, setLessons] = useState<MobileLesson[]>([]);
  const [weekLessons, setWeekLessons] = useState<MobileLesson[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sourceFetchedAt, setSourceFetchedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [apiOrigin, setApiOrigin] = useState<string>("https://studentvalue1984.eu.cc");

  // Auth and task progress states
  const [sessionUser, setSessionUser] = useState<MobileSessionUser | null>(null);
  const [taskProgress, setTaskProgress] = useState<Record<string, UserTaskProgress>>({});
  const [pendingOpsCount, setPendingOpsCount] = useState<number>(0);
  const [tasks, setTasks] = useState<CachedTask[]>([]);
  const [scheduledReminders, setScheduledReminders] = useState<Record<string, boolean>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Modals
  const [groupPickerVisible, setGroupPickerVisible] = useState<boolean>(false);
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [materialModalVisible, setMaterialModalVisible] = useState<boolean>(false);
  const [activeMaterialModalId, setActiveMaterialModalId] = useState<string | null>(null);
  const [subjectModalVisible, setSubjectModalVisible] = useState<boolean>(false);
  const [selectedLessonForModal, setSelectedLessonForModal] = useState<MobileLesson | null>(null);

  const repo = useMemo(() => getTimetableRepository(), []);
  const scrollRef = useRef<any>(null);
  const reqGenRef = useRef(0);

  // Load API origin and notification channels
  useEffect(() => {
    getActiveApiOrigin().then(setApiOrigin);
    setupNotificationChannels().catch(() => {});
  }, []);

  const loadTasks = useCallback(
    async (groupCode: string, user: MobileSessionUser | null) => {
      try {
        const cached = await repo.getCachedTasksForGroup(groupCode);
        if (cached.length > 0) {
          setTasks(cached);
        }
      } catch (err) {
        console.warn("Could not read cached tasks from SQLite:", err);
      }

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

          if (user) {
            const progressMap: Record<string, UserTaskProgress> = {};
            for (const st of serverTasks) {
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
              }
            }
            if (Object.keys(progressMap).length > 0) {
              setTaskProgress((prev) => ({ ...prev, ...progressMap }));
            }
          }
        }
      } catch (err) {
        console.warn("Could not refresh tasks from API (using SQLite cache):", err);
      }
    },
    [repo],
  );

  // Cold start directly from SQLite repository
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

      const weekStart = weekStartFor(selectedDate);
      const stored = await repo.getSnapshot(selectedGroup, weekStart);
      if (stored?.snapshot?.data?.days) {
        const allWkLessons = stored.snapshot.data.days.flatMap(
          (d: { lessons: MobileLesson[] }) => d.lessons,
        );
        setWeekLessons(allWkLessons);
      }
    } catch {
      setIsLoaded(false);
      setLessons([]);
    }
  }, [repo, selectedGroup, selectedDate]);

  // Load session user and tasks
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

        flushOutbox().catch(() => {});
      }
      await loadTasks(selectedGroup, u);
    });
  }, [repo, selectedGroup, loadTasks]);

  // Load timetable on date/group change
  useEffect(() => {
    const currentGen = ++reqGenRef.current;
    loadFromSqlite().then(() => {
      if (currentGen !== reqGenRef.current) return;
      setIsSyncing(true);
      syncTimetableFromApi(selectedGroup, selectedDate).then((result) => {
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
  }, [loadFromSqlite, selectedGroup, selectedDate]);

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

  // Restore group preference
  useEffect(() => {
    repo.getPreference("selected_group_code").then((saved) => {
      if (saved) {
        setSelectedGroup(saved);
      }
    });
  }, [repo]);

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

    const u = await getSessionUser();
    await loadTasks(selectedGroup, u);
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

  // Task self-completion toggle
  const handleToggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      if (!sessionUser) {
        setAuthModalVisible(true);
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
    [sessionUser, taskProgress, repo, tasks],
  );

  // Toggle reminder for task
  const handleToggleReminderForTask = useCallback(
    async (task: CachedTask) => {
      if (!sessionUser) {
        setAuthModalVisible(true);
        return;
      }
      if (!task.deadlineId || !task.deadlineDate) {
        Alert.alert("Дедлайн не найден", "У этого задания нет подтверждённого срока.");
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
            `Напоминание сработает за 24 часа до дедлайна (${task.deadlineMoscowStr || "по расписанию"}).`,
          );
        } else {
          Alert.alert(
            "Не удалось установить напоминание",
            "Дедлайн уже прошёл или дата не подтверждена.",
          );
        }
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

  const handleLogout = useCallback(async () => {
    await handleUserChanged(null);
  }, []);

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
      const e = parseMin(l.scheduledEnd);
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
    return nowMoscowMin >= parseMin(last.scheduledEnd);
  }, [lessons, isSelectedToday, nowMoscowMin]);

  const remainingLessons = useMemo(() => {
    if (!heroLesson) return [];
    return lessons.filter((l) => l.id !== heroLesson.id);
  }, [lessons, heroLesson]);

  const totalXp = useMemo(() => {
    if (!sessionUser) return 0;
    const completedCount = Object.values(taskProgress).filter(
      (p) => p.status === "READY" || p.status === "SUBMITTED" || p.status === "ACCEPTED",
    ).length;
    return completedCount * 50;
  }, [sessionUser, taskProgress]);

  const dateFullLabel = useMemo(() => {
    return formatFlowDate(selectedDate);
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header - clean, minimal, camera notch protected */}
      <View style={styles.topHeader}>
        <SpringPressable
          style={styles.logoButton}
          activeScale={0.92}
          onPress={() => setActiveTab("flow")}
          accessibilityRole="button"
          accessibilityLabel="Логотип Student Value"
        >
          <Image
            source={require("../../assets/brand-mark.png")}
            style={styles.brandLogoImage}
            resizeMode="contain"
          />
        </SpringPressable>

        {/* Circular Wellbeing / XP Badge (matches '0' in user's design) */}
        <SpringPressable
          onPress={() => {
            if (sessionUser) {
              setActiveTab("profile");
            } else {
              setAuthModalVisible(true);
            }
          }}
          style={styles.wellbeingBadge}
          activeScale={0.9}
          accessibilityRole="button"
          accessibilityLabel={
            sessionUser
              ? `Баллы XP: ${totalXp}. Открыть профиль.`
              : "Гостевой режим. Нажмите для входа."
          }
        >
          <Text style={styles.wellbeingText}>
            {sessionUser ? String(totalXp) : "0"}
          </Text>
          {pendingOpsCount > 0 && <View style={styles.pendingDot} />}
        </SpringPressable>
      </View>

      {/* Main Tab Screen View */}
      <View style={styles.bodyContainer}>
        {activeTab === "flow" && (
          <ScrollView
            ref={scrollRef}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
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
            {/* 1. Immersive Fullscreen Hero */}
            <FlowHeroCard
              lesson={heroLesson}
              groupCode={selectedGroup}
              dateLabel={dateFullLabel}
              isToday={isSelectedToday}
              isLoaded={isLoaded}
              totalLessonsToday={lessons.length}
              allDoneToday={allDoneToday}
              nowMoscowMinutes={nowMoscowMin}
              onSelectGroup={() => setGroupPickerVisible(true)}
              onOpenSubject={(l) => {
                setSelectedLessonForModal(l);
                setSubjectModalVisible(true);
              }}
              onScrollCuePress={() => {
                scrollRef.current?.scrollTo({
                  y: Dimensions.get("window").height - 180,
                  animated: true,
                });
              }}
            />

            {/* 2. Upcoming Lessons of the day (shown as user scrolls down) */}
            {remainingLessons.length > 0 && (
              <View style={styles.upcomingSection}>
                <Text style={styles.sectionHeaderTitle}>Далее сегодня</Text>
                {remainingLessons.map((l) => (
                  <UpcomingLessonCard
                    key={l.id}
                    lesson={l}
                    onPress={() => {
                      setSelectedLessonForModal(l);
                      setSubjectModalVisible(true);
                    }}
                  />
                ))}
              </View>
            )}

            {/* 3. Deadlines and Tasks section */}
            <View style={styles.tasksSection}>
              <Text style={styles.sectionHeaderTitle}>
                Текущая работа и дедлайны
              </Text>
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
                    В группе {selectedGroup} нет активных дедлайнов на текущей неделе.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {activeTab === "subjects" && (
          <SubjectsTab
            lessons={weekLessons.length > 0 ? weekLessons : lessons}
            tasks={tasks}
            groupCode={selectedGroup}
            onOpenLesson={(l) => {
              setSelectedLessonForModal(l);
              setSubjectModalVisible(true);
            }}
          />
        )}

        {activeTab === "deadlines" && (
          <DeadlinesTab
            tasks={tasks}
            taskProgress={taskProgress}
            groupCode={selectedGroup}
            isLoggedIn={Boolean(sessionUser)}
            scheduledReminders={scheduledReminders}
            updatingTaskId={updatingTaskId}
            onToggleStatus={handleToggleTaskStatus}
            onToggleReminder={handleToggleReminderForTask}
            onOpenMaterial={(matId) => {
              setActiveMaterialModalId(matId);
              setMaterialModalVisible(true);
            }}
            onOpenLogin={() => setAuthModalVisible(true)}
          />
        )}

        {activeTab === "profile" && (
          <ProfileTab
            sessionUser={sessionUser}
            groupCode={selectedGroup}
            cachedLessonsCount={lessons.length}
            cachedTasksCount={tasks.length}
            apiOrigin={apiOrigin}
            isStale={isStale}
            onOpenGroupPicker={() => setGroupPickerVisible(true)}
            onOpenLogin={() => setAuthModalVisible(true)}
            onLogout={handleLogout}
            onSelectOrigin={handleSelectOrigin}
            onRefreshData={handleManualSync}
          />
        )}
      </View>

      {/* Persistent Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
      />

      {/* Group Picker Modal */}
      <GroupPickerModal
        visible={groupPickerVisible}
        selectedGroup={selectedGroup}
        onSelectGroup={handleSelectGroup}
        currentOrigin={apiOrigin}
        onSelectOrigin={handleSelectOrigin}
        onClose={() => setGroupPickerVisible(false)}
      />

      {/* Subject Detail Modal */}
      <SubjectDetailModal
        visible={subjectModalVisible}
        lesson={selectedLessonForModal}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b1322",
    paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight || 28) + 4 : 0,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#0b1322",
  },
  logoButton: {
    padding: 4,
  },
  brandLogoImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  wellbeingBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    position: "relative",
  },
  wellbeingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  upcomingSection: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  tasksSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  emptyTasksBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  emptyTasksText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
