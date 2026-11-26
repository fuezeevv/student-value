import { WebView } from "react-native-webview";
import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React, { useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  PanResponder,
  Image as NativeImage,
  Linking,
} from "react-native";
import Svg, { Image, Polyline, Circle } from "react-native-svg";
import { indoorRoute, type IndoorNode } from "@studentvalue/mobile-contracts";
import graph from "../../assets/indoor/main-building.json";

const floors = [
  require("../../assets/indoor/first_floor.png"),
  require("../../assets/indoor/second_floor.png"),
  require("../../assets/indoor/third_floor.png"),
];
const nodes: IndoorNode[] = graph.nodes;
const rooms = nodes
  .filter((n) => !n.intermediate && n.room && n.room !== "*Unknown*")
  .sort((a, b) => a.room.localeCompare(b.room, "ru", { numeric: true }));
const full = { x: 0, y: 0, width: graph.width, height: graph.height };
export function CampusMapModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(createStyles);

  const [view, setView] = useState<"campus" | "indoor">("indoor");
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReload, setMapReload] = useState(0);
  const [floor, setFloor] = useState(1);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState<IndoorNode | null>(null);
  const [to, setTo] = useState<IndoorNode | null>(null);
  const [mode, setMode] = useState<"from" | "to">("to");
  const [box, setBox] = useState(full);
  const size = useRef({ width: 1, height: 1 });
  const start = useRef(full);
  const pinch = useRef(0);
  const boxRef = useRef(box);
  boxRef.current = box;
  const route = useMemo(
    () => (from && to ? indoorRoute(nodes, from.id, to.id) : []),
    [from, to],
  );
  const responders = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          start.current = boxRef.current;
          const t = e.nativeEvent.touches;
          pinch.current =
            t.length === 2
              ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY)
              : 0;
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          const initial = start.current;
          if (t.length === 2) {
            const distance = Math.hypot(
              t[0].pageX - t[1].pageX,
              t[0].pageY - t[1].pageY,
            );
            if (!pinch.current) {
              pinch.current = distance;
              start.current = boxRef.current;
              return;
            }
            const width = Math.max(
              180,
              Math.min(
                graph.width,
                (initial.width * pinch.current) / Math.max(distance, 1),
              ),
            );
            const height = (width * graph.height) / graph.width;
            setBox({
              x: initial.x + (initial.width - width) / 2,
              y: initial.y + (initial.height - height) / 2,
              width,
              height,
            });
          } else if (t.length === 1) {
            const scale = Math.max(
              initial.width / size.current.width,
              initial.height / size.current.height,
            );
            setBox({
              ...initial,
              x: Math.max(
                -initial.width / 2,
                Math.min(
                  graph.width - initial.width / 2,
                  initial.x - g.dx * scale,
                ),
              ),
              y: Math.max(
                -initial.height / 2,
                Math.min(
                  graph.height - initial.height / 2,
                  initial.y - g.dy * scale,
                ),
              ),
            });
          }
        },
      }),
    [],
  );
  const select = (node: IndoorNode) => {
    if (mode === "from") setFrom(node);
    else setTo(node);
    setFloor(node.floor);
    setQuery("");
    setBox({ x: node.x - 400, y: node.y - 225, width: 800, height: 450 });
  };
  const zoom = (factor: number) =>
    setBox((v) => {
      const width = Math.min(graph.width, Math.max(180, v.width * factor));
      const height = (width * graph.height) / graph.width;
      return {
        x: v.x + (v.width - width) / 2,
        y: v.y + (v.height - height) / 2,
        width,
        height,
      };
    });
  const tabs = (
    <View style={[s.row, { marginVertical: 10 }]}>
      {(
        [
          { id: "campus", label: "Кампус" },
          { id: "indoor", label: "Внутри главного" },
        ] as const
      ).map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === tab.id }}
          onPress={() => setView(tab.id)}
          style={[s.chip, view === tab.id && s.active]}
        >
          <Text style={s.text}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
  if (view === "campus")
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.page}>
          <View style={s.row}>
            <Text style={s.title}>Кампус СПбПУ</Text>
            <Pressable style={s.button} onPress={onClose}>
              <Text style={s.link}>Закрыть</Text>
            </Pressable>
          </View>
          {tabs}
          <Text style={s.caption}>
            Официальная схема университета · для загрузки нужен интернет
          </Text>
          {mapFailed ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={s.text}>
                Карта кампуса не загрузилась. Планы главного здания доступны без
                интернета.
              </Text>
              <Pressable
                style={s.button}
                onPress={() => {
                  setMapFailed(false);
                  setMapReload((n) => n + 1);
                }}
              >
                <Text style={s.link}>Повторить загрузку</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              key={mapReload}
              style={{ flex: 1, backgroundColor: colors.canvas }}
              source={{ uri: "https://yandex.ru/map-widget/v1/-/CCUMF8SFsC" }}
              originWhitelist={["https://yandex.ru", "https://*.yandex.ru"]}
              sharedCookiesEnabled={false}
              thirdPartyCookiesEnabled={false}
              incognito
              geolocationEnabled={false}
              allowFileAccess={false}
              allowUniversalAccessFromFileURLs={false}
              mixedContentMode="never"
              setSupportMultipleWindows={false}
              onError={() => setMapFailed(true)}
              onHttpError={(event) => {
                if (event.nativeEvent.statusCode >= 400) setMapFailed(true);
              }}
              onShouldStartLoadWithRequest={(request) => {
                try {
                  const url = new URL(request.url);
                  return (
                    url.protocol === "https:" &&
                    (url.hostname === "yandex.ru" ||
                      url.hostname.endsWith(".yandex.ru")) &&
                    (url.pathname.startsWith("/map-widget/") ||
                      url.pathname.startsWith("/maps/"))
                  );
                } catch {
                  return false;
                }
              }}
            />
          )}
          <Pressable
            style={s.button}
            onPress={() =>
              Linking.openURL("https://www.spbstu.ru/campus-map/").catch(
                () => {},
              )
            }
          >
            <Text style={s.credit}>Источник: СПбПУ · Яндекс.Карты ↗</Text>
          </Pressable>
        </View>
      </Modal>
    );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.page}>
        <View style={s.row}>
          <Text style={s.title}>Главное здание</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={s.button}
          >
            <Text style={s.link}>Закрыть</Text>
          </Pressable>
        </View>
        {tabs}
        <Text style={s.caption}>
          Планы трёх этажей · доступны без интернета
        </Text>
        <View style={s.row}>
          {([1, 2, 3] as const).map((n) => (
            <Pressable
              key={n}
              onPress={() => setFloor(n)}
              style={[s.chip, n === floor && s.active]}
            >
              <Text style={s.text}>{n} этаж</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setBox(full)} style={s.button}>
            <Text style={s.link}>Весь план</Text>
          </Pressable>
        </View>
        <View style={s.row}>
          <Pressable
            style={[s.endpoint, mode === "from" && s.active]}
            onPress={() => setMode("from")}
          >
            <Text style={s.text}>Откуда: {from?.room ?? "выбрать"}</Text>
          </Pressable>
          <Pressable
            style={[s.endpoint, mode === "to" && s.active]}
            onPress={() => setMode("to")}
          >
            <Text style={s.text}>Куда: {to?.room ?? "выбрать"}</Text>
          </Pressable>
        </View>
        <TextInput
          style={s.input}
          placeholder={
            mode === "from"
              ? "Начальная аудитория"
              : "Найти аудиторию, например 225"
          }
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.trim() ? (
          <ScrollView style={{ maxHeight: 140 }}>
            {rooms
              .filter((n) =>
                n.room
                  .toLocaleLowerCase("ru")
                  .includes(query.trim().toLocaleLowerCase("ru")),
              )
              .slice(0, 20)
              .map((n) => (
                <Pressable
                  key={n.id}
                  style={s.result}
                  onPress={() => select(n)}
                >
                  <Text style={s.text}>
                    {n.room} · {n.floor} этаж
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        ) : null}
        <View
          style={s.map}
          onLayout={(e) => {
            size.current = e.nativeEvent.layout;
          }}
          {...responders.panHandlers}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          >
            <Image
              href={NativeImage.resolveAssetSource(floors[floor - 1])}
              x={0}
              y={0}
              width={graph.width}
              height={graph.height}
            />
            {route.map((node, i) =>
              i > 0 && node.floor === floor && route[i - 1].floor === floor ? (
                <Polyline
                  key={node.id}
                  points={`${route[i - 1].x},${route[i - 1].y} ${node.x},${node.y}`}
                  stroke="#1969d9"
                  strokeWidth={8}
                  fill="none"
                />
              ) : null,
            )}
            {[from, to]
              .filter((n): n is IndoorNode => n !== null && n.floor === floor)
              .map((n, i) => (
                <Circle
                  key={`${n.id}-${i}`}
                  cx={n.x}
                  cy={n.y}
                  r={15}
                  fill={n.id === from?.id ? "#19804a" : "#ba244c"}
                  stroke="white"
                  strokeWidth={4}
                />
              ))}
          </Svg>
        </View>
        <View style={s.row}>
          <Pressable
            accessibilityLabel="Уменьшить карту"
            style={s.chip}
            onPress={() => zoom(1.5)}
          >
            <Text style={s.text}>−</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Увеличить карту"
            style={s.chip}
            onPress={() => zoom(1 / 1.5)}
          >
            <Text style={s.text}>＋</Text>
          </Pressable>
          <Text style={[s.caption, { flex: 1 }]}>
            Двигайте и масштабируйте двумя пальцами
          </Text>
        </View>
        {from && to ? (
          <Text style={s.text}>
            {route.length
              ? `Маршрут: ${from.room} → ${to.room}${from.floor !== to.floor ? " · переход по лестнице, переключите этаж" : ""}`
              : "В исходном графе маршрут не найден"}
          </Text>
        ) : null}
        <Text style={s.caption}>
          Неофициальная историческая схема PolyNavi. Покрытие: только главное
          здание. Это не схема эвакуации; доступность проходов не подтверждена.
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL(
              "https://github.com/AleksandrStarovoitov/PolyNavi",
            ).catch(() => {})
          }
        >
          <Text style={s.credit}>
            Планы: Aleksandr Starovoitov · CC BY-NC-SA 4.0. Граф: PolyNavi · MIT
            ↗
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.canvas,
      padding: 16,
      paddingTop: 32,
      paddingBottom: 24,
    },
    title: { color: colors.text, fontSize: 24, fontWeight: "700", flex: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    button: { minHeight: 48, justifyContent: "center", paddingHorizontal: 6 },
    link: { color: colors.link, fontSize: 14 },
    text: { color: colors.text, fontSize: 14, lineHeight: 20 },
    caption: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginVertical: 8,
    },
    credit: { color: colors.link, fontSize: 11, lineHeight: 16 },
    chip: {
      paddingHorizontal: 16,
      minHeight: 44,
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    active: { backgroundColor: colors.raised },
    endpoint: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      minHeight: 48,
    },
    input: {
      color: colors.text,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginVertical: 8,
      minHeight: 48,
    },
    result: { padding: 12, borderBottomWidth: 1, borderColor: colors.line },
    map: {
      flex: 1,
      backgroundColor: "#fff",
      overflow: "hidden",
      borderRadius: 12,
      minHeight: 180,
    },
  });
