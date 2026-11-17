import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Linking,
} from "react-native";

export type NewsItem = {
  id: string;
  title: string;
  date: string;
  category: "all" | "session" | "academic" | "events" | "scholarship";
  categoryLabel: string;
  preview: string;
  fullText: string;
  source: string;
  channelUrl?: string;
};

// Only project information confirmed by this repository belongs here.
// University announcements require an exact publication URL and date;
// generated stories must never be presented as institutional statements.
export const NEWS_ITEMS: NewsItem[] = [
  {
    id: "news-sv-development",
    title: "Разработка нативного Student Value",
    date: "17 ноября 2026",
    category: "events",
    categoryLabel: "Проект",
    preview: "В приложении появились навигация по дням и неделям и выбор расписания. Мобильный вход в production пока недоступен.",
    fullText:
      "Продолжается разработка нативного приложения Student Value. Реализованы выбор расписания групп и преподавателей и навигация по дням и неделям.\n\nМобильные API входа и заданий пока не опубликованы на production-сайте. Локальные проверки не означают готовность публичного приложения. Вопросы и новости проекта — в канале @studentvalue.",
    source: "Student Value · информация проекта",
    channelUrl: "https://t.me/studentvalue",
  },
];

export type NewsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export const NewsModal: React.FC<NewsModalProps> = ({ visible, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStory, setActiveStory] = useState<NewsItem | null>(null);

  const filteredNews = useMemo(() => {
    return NEWS_ITEMS.filter((item) => {
      const matchCat =
        selectedCategory === "all" || item.category === selectedCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.preview.toLowerCase().includes(q) ||
        item.fullText.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  const handleOpenChannel = (url = "https://t.me/studentvalue") => {
    Linking.openURL(url).catch(() => {});
  };

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

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Новости и анонсы</Text>
              <Text style={styles.subtitle}>
                Официальные события СПбПУ и канал @studentvalue
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Закрыть новости"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск новостей (сессия, САПР, стипендия)..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Category Filter Chips */}
          <View style={styles.categoriesRow}>
            {[
              { id: "all", label: "Все" },
              { id: "session", label: "Сессия" },
              { id: "academic", label: "Учёба" },
              { id: "events", label: "События" },
              { id: "scholarship", label: "Стипендии" },
            ].map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[
                    styles.catChip,
                    isActive && styles.catChipActive,
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.catChipText,
                      isActive && styles.catChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Telegram Channel Banner */}
          <TouchableOpacity
            style={styles.tgBanner}
            onPress={() => handleOpenChannel("https://t.me/studentvalue")}
            activeOpacity={0.8}
            accessibilityRole="link"
          >
            <View style={styles.tgBannerIcon}>
              <Text style={styles.tgIconText}>✈</Text>
            </View>
            <View style={styles.tgBannerContent}>
              <Text style={styles.tgBannerTitle}>Канал t.me/studentvalue</Text>
              <Text style={styles.tgBannerSub}>
                Оперативные новости, учебные материалы и обсуждения
              </Text>
            </View>
            <Text style={styles.tgArrow}>→</Text>
          </TouchableOpacity>

          {/* News List */}
          <ScrollView
            style={styles.newsListScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.newsListContent}
          >
            {filteredNews.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.newsCard}
                onPress={() => setActiveStory(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagText}>{item.categoryLabel}</Text>
                  </View>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>

                <Text style={styles.newsTitle}>{item.title}</Text>
                <Text style={styles.newsPreview}>{item.preview}</Text>

                <View style={styles.cardFooterRow}>
                  <Text style={styles.sourceText}>Источник: {item.source}</Text>
                  <Text style={styles.readMoreText}>Подробнее →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Story Detail View Modal */}
          {activeStory && (
            <Modal
              visible={Boolean(activeStory)}
              transparent
              animationType="slide"
              onRequestClose={() => setActiveStory(null)}
            >
              <Pressable
                style={styles.storyBackdrop}
                onPress={() => setActiveStory(null)}
              >
                <Pressable
                  style={styles.storySheet}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={styles.handle} />

                  <View style={styles.cardHeaderRow}>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagText}>
                        {activeStory.categoryLabel}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>{activeStory.date}</Text>
                  </View>

                  <Text style={styles.storyTitle}>{activeStory.title}</Text>

                  <ScrollView style={styles.storyBodyScroll}>
                    <Text style={styles.storyBodyText}>
                      {activeStory.fullText}
                    </Text>
                  </ScrollView>

                  <View style={styles.storyFooter}>
                    <Text style={styles.storySource}>
                      {activeStory.source}
                    </Text>
                    {activeStory.channelUrl && (
                      <TouchableOpacity
                        style={styles.storyChannelBtn}
                        onPress={() => handleOpenChannel(activeStory.channelUrl)}
                      >
                        <Text style={styles.storyChannelBtnText}>
                          Открыть в Telegram ↗
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
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
    maxHeight: "92%",
  },
  handle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
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
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "700",
  },
  searchBarContainer: {
    marginBottom: 10,
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
  categoriesRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  catChipActive: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "#3b82f6",
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8a9bb5",
  },
  catChipTextActive: {
    color: "#93c5fd",
    fontWeight: "700",
  },
  tgBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 158, 217, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 158, 217, 0.25)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  tgBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#229ed9",
    alignItems: "center",
    justifyContent: "center",
  },
  tgIconText: {
    color: "#ffffff",
    fontSize: 18,
  },
  tgBannerContent: {
    flex: 1,
  },
  tgBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  tgBannerSub: {
    fontSize: 11,
    color: "#93c5fd",
    marginTop: 1,
  },
  tgArrow: {
    fontSize: 18,
    color: "#93c5fd",
    fontWeight: "700",
  },
  newsListScroll: {
    maxHeight: 340,
  },
  newsListContent: {
    gap: 10,
    paddingBottom: 16,
  },
  newsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#93c5fd",
  },
  dateText: {
    fontSize: 11,
    color: "#64748b",
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
    lineHeight: 20,
    marginBottom: 4,
  },
  newsPreview: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sourceText: {
    fontSize: 11,
    color: "#64748b",
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
  },
  storyBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  storySheet: {
    backgroundColor: "#0d1829",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    maxHeight: "85%",
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    lineHeight: 24,
    marginVertical: 10,
  },
  storyBodyScroll: {
    maxHeight: 260,
    marginVertical: 10,
  },
  storyBodyText: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 22,
  },
  storyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  storySource: {
    fontSize: 12,
    color: "#64748b",
  },
  storyChannelBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  storyChannelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
