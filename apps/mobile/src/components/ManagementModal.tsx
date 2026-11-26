import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { z } from "zod";
import { getSessionToken } from "../auth/token-storage";
import { getActiveApiOrigin } from "../api/client";
import { sessionGeneration, isCurrentSession } from "../auth/session-lifecycle";
import { useTheme } from "../theme/ThemeProvider";
const schema = z.object({
  canEditTasks: z.boolean(),
  canEditDeadlines: z.boolean(),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        status: z.enum(["PUBLISHED", "ARCHIVED"]),
        updatedAt: z.iso.datetime(),
        courseOffering: z.object({
          courseDefinition: z.object({ title: z.string() }),
        }),
        deadlines: z.array(
          z.object({
            id: z.string(),
            date: z.iso.datetime(),
            status: z.enum(["ACTIVE", "CANCELLED"]),
            isTimeStrict: z.boolean(),
          }),
        ),
      }),
    )
    .max(200),
});
type Item = z.infer<typeof schema>["items"][number];
export function ManagementModal({
  visible,
  onClose,
  groupCode,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  groupCode: string;
  onChanged?: () => void;
}) {
  const { colors } = useTheme();
  const [data, setData] = useState<z.infer<typeof schema> | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setData(null);
    setItem(null);
    setError("");
    if (!visible) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const generation = sessionGeneration();
    setBusy(true);
    (async () => {
      const origin = await getActiveApiOrigin();
      const token = await getSessionToken();
      if (!token) throw Error("Войдите в аккаунт");
      if (
        !isCurrentSession(generation) ||
        (await getActiveApiOrigin()) !== origin
      )
        throw Error("Сессия или сервер изменились");
      const r = await fetch(
        `${origin}/api/v1/manage?group=${encodeURIComponent(groupCode)}`,
        {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!r.ok)
        throw Error(
          r.status === 403
            ? "Недостаточно прав в выбранной группе"
            : "Не удалось открыть панель",
        );
      const result = schema.parse(await r.json());
      if (active && isCurrentSession(generation)) setData(result);
    })()
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [visible, groupCode, revision]);
  const apply = async (body: Record<string, unknown>) => {
    if (busy) return;
    if (note.trim().length < 8) {
      setError("Укажите основание изменения: минимум 8 символов.");
      return;
    }
    setBusy(true);
    setError("");
    const generation = sessionGeneration();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const origin = await getActiveApiOrigin();
      const token = await getSessionToken();
      if (!token) throw Error("Войдите в аккаунт");
      if (
        !isCurrentSession(generation) ||
        (await getActiveApiOrigin()) !== origin
      )
        throw Error("Сессия или сервер изменились");
      const r = await fetch(
        `${origin}/api/v1/manage?group=${encodeURIComponent(groupCode)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, reason: note, sourceNote: note }),
        },
      );
      if (!r.ok)
        throw Error(
          "Изменение не применено. Проверьте права, дату и актуальность записи.",
        );
      if (isCurrentSession(generation)) {
        setNote("");
        setRevision((n) => n + 1);
        onChanged?.();
        Alert.alert(
          "Сохранено",
          "Изменение записано с основанием и аудитом. Учебные данные обновляются.",
        );
      }
    } catch (e) {
      if (isCurrentSession(generation))
        setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      clearTimeout(timer);
      if (isCurrentSession(generation)) setBusy(false);
    }
  };
  const button = (label: string, action: () => void, danger = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={{
        padding: 14,
        minHeight: 48,
        borderRadius: 12,
        backgroundColor: colors.soft,
        marginVertical: 4,
      }}
    >
      <Text
        style={{ color: danger ? colors.danger : colors.link, fontSize: 15 }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    minHeight: 48,
    marginVertical: 6,
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          padding: 20,
          paddingTop: 32,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 25,
              fontWeight: "700",
              flex: 1,
            }}
          >
            Панель старосты
          </Text>
          {button("Закрыть", onClose)}
        </View>
        <Text style={{ color: colors.muted, marginVertical: 12 }}>
          Работы и сроки · {groupCode}. Все изменения сохраняют историю и личный
          прогресс.
        </Text>
        {busy ? <ActivityIndicator color={colors.link} /> : null}
        {error ? (
          <Text style={{ color: colors.danger, marginVertical: 12 }}>
            {error}
          </Text>
        ) : null}
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          {item ? (
            <>
              {button("← К списку", () => {
                setItem(null);
                setNote("");
              })}
              <Text style={{ color: colors.muted }}>
                {item.courseOffering.courseDefinition.title}
              </Text>
              <TextInput
                editable={data?.canEditTasks && !busy}
                accessibilityLabel="Название задания"
                style={inputStyle}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                editable={data?.canEditTasks && !busy}
                accessibilityLabel="Описание задания"
                multiline
                style={[inputStyle, { minHeight: 100 }]}
                value={description}
                onChangeText={setDescription}
              />
              <TextInput
                accessibilityLabel="Основание изменения"
                placeholder="Что и на каком основании изменяем"
                placeholderTextColor={colors.subtle}
                multiline
                style={inputStyle}
                value={note}
                onChangeText={setNote}
              />
              {data?.canEditTasks && item.status === "PUBLISHED"
                ? button(
                    "Сохранить текст задания",
                    () =>
                      void apply({
                        action: "edit",
                        id: item.id,
                        title,
                        description,
                        updatedAt: item.updatedAt,
                      }),
                  )
                : null}
              {data?.canEditTasks
                ? button(
                    item.status === "ARCHIVED"
                      ? "Восстановить работу"
                      : "Архивировать работу",
                    () =>
                      Alert.alert(
                        item.status === "ARCHIVED"
                          ? "Восстановить работу?"
                          : "Архивировать работу?",
                        "Личный прогресс сохранится. Изменение повлияет на видимость задания и Calendar.",
                        [
                          { text: "Отмена", style: "cancel" },
                          {
                            text: "Применить",
                            onPress: () =>
                              void apply({
                                action: "archive",
                                id: item.id,
                                value: item.status !== "ARCHIVED",
                              }),
                          },
                        ],
                      ),
                    true,
                  )
                : null}
              {data?.canEditDeadlines ? (
                <>
                  {item.deadlines.some(
                    (deadline) => deadline.status === "ACTIVE",
                  ) ? (
                    <TextInput
                      accessibilityLabel="Новая дата срока"
                      placeholder="Новая дата: ГГГГ-ММ-ДД"
                      placeholderTextColor={colors.subtle}
                      style={inputStyle}
                      value={day}
                      onChangeText={setDay}
                    />
                  ) : null}
                  {item.deadlines.map((deadline) => (
                    <View
                      key={deadline.id}
                      style={{
                        paddingVertical: 16,
                        borderBottomWidth: 1,
                        borderColor: colors.line,
                      }}
                    >
                      <Text style={{ color: colors.text }}>
                        {deadline.isTimeStrict
                          ? new Date(deadline.date).toLocaleString("ru-RU", {
                              timeZone: "Europe/Moscow",
                            })
                          : new Date(deadline.date).toLocaleDateString(
                              "ru-RU",
                              { timeZone: "Europe/Moscow" },
                            )}{" "}
                        МСК ·{" "}
                        {deadline.status === "CANCELLED"
                          ? "отменён"
                          : "действующий"}
                      </Text>
                      {deadline.status === "ACTIVE"
                        ? button(
                            "Перенести на указанную дату",
                            () =>
                              void apply({
                                action: "reschedule",
                                id: deadline.id,
                                day,
                              }),
                          )
                        : null}
                      {button(
                        deadline.status === "CANCELLED"
                          ? "Восстановить срок"
                          : "Отменить ошибочный срок",
                        () =>
                          void apply({
                            action: "cancel-deadline",
                            id: deadline.id,
                            value: deadline.status !== "CANCELLED",
                          }),
                        true,
                      )}
                    </View>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            data?.items.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                onPress={() => {
                  setItem(entry);
                  setTitle(entry.title);
                  setDescription(entry.description ?? "");
                  setNote("");
                  setDay("");
                }}
                style={{
                  paddingVertical: 20,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {entry.courseOffering.courseDefinition.title} ·{" "}
                  {entry.status === "ARCHIVED" ? "архив" : "опубликовано"}
                </Text>
                <Text
                  style={{ color: colors.text, fontSize: 17, marginTop: 8 }}
                >
                  {entry.title} →
                </Text>
              </Pressable>
            ))
          )}
          {!item ? (
            <Text
              style={{ color: colors.muted, lineHeight: 20, marginTop: 20 }}
            >
              Приглашения, публикация новых работ, преподаватели и проверка
              результатов пока доступны в полной панели на сайте.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
