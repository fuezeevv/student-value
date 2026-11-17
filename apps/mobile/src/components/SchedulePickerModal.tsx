import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  KNOWN_API_ORIGINS,
  searchRuzTeachers,
  searchRuzGroups,
  type RuzSearchTeacher,
  type RuzSearchGroup,
} from "../api/client";
import { getTimetableRepository } from "../storage/repository";

import { PUBLIC_GROUPS } from "@studentvalue/mobile-contracts";
export { PUBLIC_GROUPS };

// Search results come from RUZ. Do not seed unverified names, IDs or teaching roles.
export const POPULAR_TEACHERS: RuzSearchTeacher[] = [];

export type PinnedSchedule = {
  type: "group" | "teacher";
  id: string; // group code or teacher id
  name: string; // display name
  subtext?: string;
  ruzId?: number;
};

export type SchedulePickerModalProps = {
  visible: boolean;
  selectedSchedule: string; // group code or teacher name
  onSelectGroup: (code: string, ruzId?: number) => void;
  onSelectTeacher: (teacherId: number, teacherName: string) => void;
  currentOrigin?: string;
  onSelectOrigin?: (origin: string) => void;
  onClose: () => void;
};

export const SchedulePickerModal: React.FC<SchedulePickerModalProps> = ({
  visible,
  selectedSchedule,
  onSelectGroup,
  onSelectTeacher,
  currentOrigin,
  onSelectOrigin,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    "groups" | "teachers" | "favorites"
  >("groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [groupSearchResults, setGroupSearchResults] = useState<
    RuzSearchGroup[]
  >([]);
  const [teacherSearchResults, setTeacherSearchResults] = useState<
    RuzSearchTeacher[]
  >([]);
  const [pinnedSchedules, setPinnedSchedules] = useState<PinnedSchedule[]>([
    {
      type: "group",
      id: "5130901/40102",
      name: "5130901/40102",
      subtext: "ИВТ-102",
      ruzId: 45591,
    },
    {
      type: "teacher",
      id: "5796",
      name: "Сиднев Александр Георгиевич",
      subtext: "САПР / СППР",
      ruzId: 5796,
    },
  ]);

  const repo = useMemo(() => getTimetableRepository(), []);

  // Load pinned schedules from SQLite preferences
  useEffect(() => {
    if (visible) {
      repo.getPreference("pinned_schedules").then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length <= 100) {
              setPinnedSchedules(parsed);
            }
          } catch {}
        }
      });
    }
  }, [visible, repo]);

  const savePinned = useCallback(
    async (next: PinnedSchedule[]) => {
      setPinnedSchedules(next);
      await repo.setPreference("pinned_schedules", JSON.stringify(next));
    },
    [repo],
  );

  const togglePin = useCallback(
    (item: PinnedSchedule) => {
      const exists = pinnedSchedules.some(
        (p) => p.type === item.type && p.id === item.id,
      );
      if (exists) {
        savePinned(
          pinnedSchedules.filter(
            (p) => !(p.type === item.type && p.id === item.id),
          ),
        );
      } else {
        savePinned([...pinnedSchedules, item]);
      }
    },
    [pinnedSchedules, savePinned],
  );

  const isPinned = useCallback(
    (type: "group" | "teacher", id: string) => {
      return pinnedSchedules.some((p) => p.type === type && p.id === id);
    },
    [pinnedSchedules],
  );

  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setGroupSearchResults([]);
      setTeacherSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        if (activeTab === "groups") {
          const groups = await searchRuzGroups(q);
          if (active) setGroupSearchResults(groups);
        } else if (activeTab === "teachers") {
          const teachers = await searchRuzTeachers(q);
          if (active) setTeacherSearchResults(teachers);
        }
      } catch (error) {
        if (active) {
          setGroupSearchResults([]);
          setTeacherSearchResults([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Поиск временно недоступен",
          );
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <Text style={styles.title}>Расписание</Text>
          <Text style={styles.subtitle}>
            Группы и преподаватели Санкт-Петербургского политеха
          </Text>

          {/* Segmented Control */}
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              onPress={() => {
                setActiveTab("groups");
                setSearchQuery("");
              }}
              style={[
                styles.segmentButton,
                activeTab === "groups" && styles.segmentButtonActive,
              ]}
              accessibilityRole="tab"
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "groups" && styles.segmentTextActive,
                ]}
              >
                Группы
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab("teachers");
                setSearchQuery("");
              }}
              style={[
                styles.segmentButton,
                activeTab === "teachers" && styles.segmentButtonActive,
              ]}
              accessibilityRole="tab"
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "teachers" && styles.segmentTextActive,
                ]}
              >
                Преподаватели
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab("favorites");
                setSearchQuery("");
              }}
              style={[
                styles.segmentButton,
                activeTab === "favorites" && styles.segmentButtonActive,
              ]}
              accessibilityRole="tab"
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "favorites" && styles.segmentTextActive,
                ]}
              >
                ★ Избранное ({pinnedSchedules.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar for groups/teachers */}
          {activeTab !== "favorites" && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activeTab === "groups"
                    ? "Поиск группы (40102, ИВТ, 3530201)..."
                    : "Поиск преподавателя (Сиднев, Тарасов)..."
                }
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {isSearching && (
                <ActivityIndicator
                  size="small"
                  color="#93c5fd"
                  style={styles.searchSpinner}
                />
              )}
            </View>
          )}

          {searchError && (
            <Text
              accessibilityRole="alert"
              style={{ color: "#fda4af", padding: 16 }}
            >
              {searchError}
            </Text>
          )}
          {/* Tab 1: Groups */}
          {activeTab === "groups" && (
            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {groupSearchResults.length > 0 ? (
                <View>
                  <Text style={styles.sectionHeader}>
                    Результаты поиска в РУЗ
                  </Text>
                  {groupSearchResults.map((g) => {
                    const isSelected = g.name === selectedSchedule;
                    const pinned = isPinned("group", g.name);
                    return (
                      <View key={g.id} style={styles.searchResultRow}>
                        <TouchableOpacity
                          style={[
                            styles.searchResultCard,
                            isSelected && styles.cardSelected,
                          ]}
                          onPress={() => {
                            onSelectGroup(g.name, g.id);
                            onClose();
                          }}
                        >
                          <Text
                            style={[
                              styles.resultTitle,
                              isSelected && styles.textSelected,
                            ]}
                          >
                            {g.name}
                          </Text>
                          {g.faculty?.name && (
                            <Text
                              style={styles.resultSubtext}
                              numberOfLines={1}
                            >
                              {g.faculty.name}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pinBtn}
                          onPress={() =>
                            togglePin({
                              type: "group",
                              id: g.name,
                              name: g.name,
                              subtext: g.faculty?.abbr || g.faculty?.name,
                              ruzId: g.id,
                            })
                          }
                          accessibilityLabel="В избранное"
                        >
                          <Text
                            style={[
                              styles.pinIcon,
                              pinned && styles.pinIconActive,
                            ]}
                          >
                            {pinned ? "★" : "☆"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : searchQuery.trim().length >= 2 && !isSearching ? (
                <View style={styles.emptySearchBox}>
                  <Text style={styles.emptySearchText}>
                    Группы по запросу «{searchQuery}» не найдены
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.sectionHeader}>
                    Официальные группы кафедры
                  </Text>
                  <View style={styles.grid}>
                    {PUBLIC_GROUPS.map((g) => {
                      const isSelected = g.code === selectedSchedule;
                      const pinned = isPinned("group", g.code);
                      return (
                        <View key={g.code} style={styles.gridCardWrapper}>
                          <TouchableOpacity
                            onPress={() => {
                              onSelectGroup(g.code, g.ruzId);
                              onClose();
                            }}
                            style={[
                              styles.groupButton,
                              isSelected && styles.groupButtonSelected,
                            ]}
                            accessibilityRole="button"
                          >
                            <View style={styles.labelRow}>
                              <Text
                                style={[
                                  styles.trackText,
                                  isSelected && styles.textSelected,
                                ]}
                              >
                                {g.track}
                              </Text>
                              <Text
                                style={[
                                  styles.labelText,
                                  isSelected && styles.textSelected,
                                ]}
                              >
                                {g.label}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.codeText,
                                isSelected && styles.codeSelected,
                              ]}
                            >
                              {g.code}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.gridPinBtn}
                            onPress={() =>
                              togglePin({
                                type: "group",
                                id: g.code,
                                name: g.code,
                                subtext: `${g.track}-${g.label}`,
                                ruzId: g.ruzId,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.pinIconSmall,
                                pinned && styles.pinIconActive,
                              ]}
                            >
                              {pinned ? "★" : "☆"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Tab 2: Teachers */}
          {activeTab === "teachers" && (
            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {teacherSearchResults.length > 0 ? (
                <View>
                  <Text style={styles.sectionHeader}>Преподаватели из РУЗ</Text>
                  {teacherSearchResults.map((t) => {
                    const isSelected = t.full_name === selectedSchedule;
                    const pinned = isPinned("teacher", String(t.id));
                    return (
                      <View key={t.id} style={styles.searchResultRow}>
                        <TouchableOpacity
                          style={[
                            styles.searchResultCard,
                            isSelected && styles.cardSelected,
                          ]}
                          onPress={() => {
                            onSelectTeacher(t.id, t.full_name);
                            onClose();
                          }}
                        >
                          <Text
                            style={[
                              styles.resultTitle,
                              isSelected && styles.textSelected,
                            ]}
                          >
                            {t.full_name}
                          </Text>
                          {t.chair && (
                            <Text
                              style={styles.resultSubtext}
                              numberOfLines={2}
                            >
                              {t.chair}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pinBtn}
                          onPress={() =>
                            togglePin({
                              type: "teacher",
                              id: String(t.id),
                              name: t.full_name,
                              subtext: t.chair,
                              ruzId: t.id,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pinIcon,
                              pinned && styles.pinIconActive,
                            ]}
                          >
                            {pinned ? "★" : "☆"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : searchQuery.trim().length >= 2 && !isSearching ? (
                <View style={styles.emptySearchBox}>
                  <Text style={styles.emptySearchText}>
                    Преподаватели по запросу «{searchQuery}» не найдены
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.sectionHeader}>
                    Найдите преподавателя по фамилии
                  </Text>
                  {POPULAR_TEACHERS.map((t) => {
                    const isSelected = t.full_name === selectedSchedule;
                    const pinned = isPinned("teacher", String(t.id));
                    return (
                      <View key={t.id} style={styles.searchResultRow}>
                        <TouchableOpacity
                          style={[
                            styles.searchResultCard,
                            isSelected && styles.cardSelected,
                          ]}
                          onPress={() => {
                            onSelectTeacher(t.id, t.full_name);
                            onClose();
                          }}
                        >
                          <Text
                            style={[
                              styles.resultTitle,
                              isSelected && styles.textSelected,
                            ]}
                          >
                            {t.full_name}
                          </Text>
                          <Text style={styles.resultSubtext}>{t.chair}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pinBtn}
                          onPress={() =>
                            togglePin({
                              type: "teacher",
                              id: String(t.id),
                              name: t.full_name,
                              subtext: t.chair,
                              ruzId: t.id,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pinIcon,
                              pinned && styles.pinIconActive,
                            ]}
                          >
                            {pinned ? "★" : "☆"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* Tab 3: Favorites */}
          {activeTab === "favorites" && (
            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {pinnedSchedules.length > 0 ? (
                pinnedSchedules.map((item) => {
                  const isSelected =
                    item.name === selectedSchedule ||
                    item.id === selectedSchedule;
                  return (
                    <View
                      key={`${item.type}-${item.id}`}
                      style={styles.searchResultRow}
                    >
                      <TouchableOpacity
                        style={[
                          styles.searchResultCard,
                          isSelected && styles.cardSelected,
                        ]}
                        onPress={() => {
                          if (item.type === "group") {
                            onSelectGroup(item.name, item.ruzId);
                          } else {
                            onSelectTeacher(Number(item.id), item.name);
                          }
                          onClose();
                        }}
                      >
                        <View style={styles.favoriteBadgeRow}>
                          <View
                            style={[
                              styles.badgePill,
                              item.type === "teacher"
                                ? styles.badgeTeacher
                                : styles.badgeGroup,
                            ]}
                          >
                            <Text style={styles.badgeText}>
                              {item.type === "teacher"
                                ? "Преподаватель"
                                : "Группа"}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.resultTitle,
                            isSelected && styles.textSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.subtext && (
                          <Text style={styles.resultSubtext}>
                            {item.subtext}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pinBtn}
                        onPress={() => togglePin(item)}
                      >
                        <Text style={[styles.pinIcon, styles.pinIconActive]}>
                          ★
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptySearchBox}>
                  <Text style={styles.emptySearchText}>
                    Нет сохранённых расписаний.{"\n"}Нажмите ★ возле группы или
                    преподавателя, чтобы добавить в избранное.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* API Origin Selector */}
          {onSelectOrigin && (
            <View style={styles.originSection}>
              <Text style={styles.originTitle}>Сервер API (Origin)</Text>
              <View style={styles.originRow}>
                {KNOWN_API_ORIGINS.map((env) => {
                  const isCurrent = currentOrigin === env.origin;
                  return (
                    <TouchableOpacity
                      key={env.id}
                      onPress={() => onSelectOrigin(env.origin)}
                      style={[
                        styles.originButton,
                        isCurrent && styles.originButtonSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Выбрать источник ${env.label}`}
                    >
                      <Text
                        style={[
                          styles.originButtonText,
                          isCurrent && styles.originButtonTextSelected,
                        ]}
                      >
                        {env.label.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0d1829",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    maxHeight: "88%",
  },
  handle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#8a9bb5",
    marginTop: 2,
    marginBottom: 14,
  },
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  segmentButtonActive: {
    backgroundColor: "#2563eb",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  searchContainer: {
    position: "relative",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchSpinner: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  scrollArea: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridCardWrapper: {
    width: "48%",
    position: "relative",
  },
  groupButton: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  groupButtonSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    borderColor: "#3b82f6",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 2,
  },
  trackText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#93c5fd",
  },
  labelText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f8fafc",
  },
  codeText: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "monospace",
  },
  codeSelected: {
    color: "#93c5fd",
  },
  textSelected: {
    color: "#ffffff",
  },
  gridPinBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    padding: 6,
  },
  pinIconSmall: {
    fontSize: 14,
    color: "#64748b",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  searchResultCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    borderColor: "#3b82f6",
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 2,
  },
  resultSubtext: {
    fontSize: 12,
    color: "#8a9bb5",
    lineHeight: 16,
  },
  pinBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  pinIcon: {
    fontSize: 18,
    color: "#64748b",
  },
  pinIconActive: {
    color: "#f59e0b",
  },
  favoriteBadgeRow: {
    marginBottom: 4,
  },
  badgePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTeacher: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
  },
  badgeGroup: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#c084fc",
  },
  emptySearchBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySearchText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  originSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  originTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  originRow: {
    flexDirection: "row",
    gap: 8,
  },
  originButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  originButtonSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  originButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8a9bb5",
  },
  originButtonTextSelected: {
    color: "#93c5fd",
  },
});
