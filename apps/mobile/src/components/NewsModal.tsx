import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  RefreshControl,
} from "react-native";
import { z } from "zod";
import { getActiveApiOrigin } from "../api/client";
import { getTimetableRepository } from "../storage/repository";

const telegramUrl = z
  .string()
  .regex(/^https:\/\/t\.me\/(studentvalue|sss_iccs|polyctf)\/[1-9][0-9]*$/);
const feedSchema = z.object({
  fetchedAt: z.iso.datetime(),
  posts: z
    .array(
      z.object({
        id: z.string().max(100),
        sourceId: z.enum(["studentvalue", "sss_iccs", "polyctf"]),
        url: telegramUrl,
        publishedAt: z.iso.datetime(),
        text: z.string().max(12000),
      }),
    )
    .max(100),
  sources: z
    .array(
      z.object({
        id: z.string().max(100),
        label: z.string().max(120),
        status: z.enum(["OK", "UNAVAILABLE", "NOT_CONFIGURED"]),
      }),
    )
    .max(20),
});
type Feed = z.infer<typeof feedSchema>;
export function NewsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(createStyles);

  const [feed, setFeed] = useState<Feed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    setBusy(true);
    setError("");
    (async () => {
      const origin = await getActiveApiOrigin();
      const key = `public_community_feed:${origin}`;
      const repo = getTimetableRepository();
      const saved = await repo.getPreference(key);
      if (saved && active) {
        try {
          setFeed(feedSchema.parse(JSON.parse(saved)));
        } catch {
          /* Ignore invalid cache. */
        }
      }
      const response = await fetch(`${origin}/api/v1/feed`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Источник временно недоступен");
      const raw = await response.text();
      if (raw.length > 2_000_000) throw new Error("Ответ слишком велик");
      const value = feedSchema.parse(JSON.parse(raw));
      if (active) {
        setFeed(value);
        await repo.setPreference(key, JSON.stringify(value));
      }
    })()
      .catch(() => {
        if (active)
          setError(
            "Обновить ленту не удалось. Сохранённые публикации остаются доступны.",
          );
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, reload]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.page}>
        <View style={s.heading}>
          <Text style={s.title}>Лента сообщества</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть ленту"
            onPress={onClose}
            style={s.button}
          >
            <Text style={s.link}>Закрыть</Text>
          </Pressable>
        </View>
        <Text style={s.caption}>
          Публичные посты источников. Это не объявления преподавателей и не
          новые дедлайны.
        </Text>
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          contentContainerStyle={s.filters}
        >
          {[
            { id: "all", label: "Все" },
            ...(feed?.sources ?? []).filter((source) => source.status === "OK"),
          ].map((source) => (
            <Pressable
              key={source.id}
              onPress={() => setSelected(source.id)}
              style={[s.chip, selected === source.id && s.chosen]}
            >
              <Text style={s.text}>{source.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => setReload((n) => n + 1)}
              tintColor={colors.link}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {error ? <Text style={s.warning}>{error}</Text> : null}
          {feed ? (
            <Text style={s.caption}>
              Обновлено {new Date(feed.fetchedAt).toLocaleString("ru-RU")}
            </Text>
          ) : (
            <Text style={s.caption}>
              {busy
                ? "Загружаем реальные публикации…"
                : "Публикации пока не загружены"}
            </Text>
          )}
          {feed?.posts
            .filter((p) => selected === "all" || selected === p.sourceId)
            .map((post) => (
              <View key={post.id} style={s.post}>
                <Text style={s.source}>
                  {
                    feed.sources.find((source) => source.id === post.sourceId)
                      ?.label
                  }{" "}
                  · {new Date(post.publishedAt).toLocaleDateString("ru-RU")}
                </Text>
                <Pressable
                  onPress={() =>
                    setExpanded(expanded === post.id ? null : post.id)
                  }
                >
                  <Text
                    style={s.text}
                    numberOfLines={expanded === post.id ? undefined : 7}
                  >
                    {post.text}
                  </Text>
                </Pressable>
                <Pressable
                  style={s.button}
                  accessibilityRole="link"
                  onPress={() =>
                    Linking.openURL(post.url).catch(() =>
                      setError("Не удалось открыть оригинал"),
                    )
                  }
                >
                  <Text style={s.link}>Оригинал публикации ↗</Text>
                </Pressable>
              </View>
            ))}
          {feed?.sources
            .filter((source) => source.status !== "OK")
            .map((source) => (
              <Text key={source.id} style={s.warning}>
                {source.label}:{" "}
                {source.status === "NOT_CONFIGURED"
                  ? "автоматическое получение постов пока не подключено"
                  : "источник временно недоступен"}
                .
              </Text>
            ))}
          <Text style={s.caption}>
            Подключены проверенные публичные страницы. Каталог источников пока
            не охватывает все сообщества ИКНК. Потяните вниз для обновления.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.canvas,
      paddingHorizontal: 20,
      paddingTop: 32,
    },
    heading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: { color: colors.text, fontSize: 25, fontWeight: "700", flex: 1 },
    text: { color: colors.text, fontSize: 15, lineHeight: 23 },
    caption: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginVertical: 12,
    },
    source: { color: colors.link, fontSize: 12, marginBottom: 10 },
    post: {
      paddingVertical: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    button: { minHeight: 48, justifyContent: "center" },
    link: { color: colors.link, fontSize: 14 },
    warning: { color: "#e5b9a9", lineHeight: 20, marginVertical: 12 },
    filters: { gap: 8, paddingVertical: 8 },
    chip: {
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chosen: { backgroundColor: colors.raised },
  });
