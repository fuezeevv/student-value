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
  Platform,
} from "react-native";

export type CampusBuilding = {
  id: string;
  number: string;
  name: string;
  shortName: string;
  category: "study" | "food" | "sport" | "admin" | "transport";
  address: string;
  coords: { lat: number; lng: number };
  description: string;
  typicalClasses: string;
  entranceTips: string;
  floorsInfo?: string;
  hasDining?: boolean;
};

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: "b3",
    number: "3",
    name: "3-й учебный корпус",
    shortName: "3 к. (ФИСТ / ИКНК)",
    category: "study",
    address: "Политехническая ул., 29, лит. Н",
    coords: { lat: 60.0028, lng: 30.3739 },
    description: "Основной корпус для студентов направлений ИВТ и ИСиТ. Здесь расположены кафедры компьютерных технологий и аудитории компьютерной графики.",
    typicalClasses: "Компьютерная графика, САПР, СОВД, Программирование (ауд. 402, 406, 408)",
    entranceTips: "Вход с центральной аллеи парка. В холле гардероб и проходная по пропускам. Лифты расположены по центру.",
    floorsInfo: "1 этаж: Буфет, гардероб. 4 этаж: Ауд. 402, 406, 408, деканат ИКНК.",
    hasDining: true,
  },
  {
    id: "guk",
    number: "ГУК",
    name: "Главный учебный корпус",
    shortName: "Главный корпус (ГУК)",
    category: "admin",
    address: "Политехническая ул., 29",
    coords: { lat: 60.0072, lng: 30.3722 },
    description: "Историческое сердце университета с колоннами и парком. Здесь находятся Белый зал, Фундаментальная библиотека и Ректорат.",
    typicalClasses: "Лекции общих потоков, торжественные мероприятия, Белый зал",
    entranceTips: "Центральный парадный вход с широкой лестницей напротив метро Политехническая.",
    floorsInfo: "1 этаж: Ректорат, гардероб. 2 этаж: Белый зал. 3 этаж: Фундаментальная библиотека.",
    hasDining: true,
  },
  {
    id: "nik",
    number: "НИК",
    name: "Научно-исследовательский корпус",
    shortName: "НИК",
    category: "study",
    address: "Политехническая ул., 29АФ",
    coords: { lat: 60.0051, lng: 30.3794 },
    description: "Современный высокотехнологичный комплекс со стеклянным атриумом, лекториями, хакатонами и выставочными пространствами.",
    typicalClasses: "Научные конференции, проектная деятельность, открытые лекции",
    entranceTips: "Парадный стеклянный вход со стороны ул. Политехническая и парка.",
    floorsInfo: "Атриум с кофейней, конференц-залы «Семенов», «Лезгинцев», лаборатории.",
    hasDining: true,
  },
  {
    id: "b1",
    number: "1",
    name: "1-й учебный корпус",
    shortName: "1 к. (ФизМех)",
    category: "study",
    address: "Политехническая ул., 29Б",
    coords: { lat: 60.0061, lng: 30.3745 },
    description: "Физико-механический институт и кафедры высшей математики и теоретической механики.",
    typicalClasses: "Математический анализ, общая физика, лекционные аудитории",
    entranceTips: "Вход со стороны парка между ГУК и 2-м корпусом.",
    floorsInfo: "Большая столовая на 1 этаже, лекционные аудитории 100-х и 200-х номеров.",
    hasDining: true,
  },
  {
    id: "b2",
    number: "2",
    name: "2-й учебный корпус",
    shortName: "2 к. (Энерго)",
    category: "study",
    address: "Политехническая ул., 29В",
    coords: { lat: 60.0053, lng: 30.3758 },
    description: "Институт энергетики, кафедры электротехники и автоматики.",
    typicalClasses: "Электротехника, схемотехника, электроника",
    entranceTips: "Вход с аллеи со стороны Гидробашни.",
    hasDining: false,
  },
  {
    id: "b4",
    number: "4",
    name: "4-й учебный корпус",
    shortName: "4 к. (Лабораторный)",
    category: "study",
    address: "Политехническая ул., 29, корп. 4",
    coords: { lat: 60.0039, lng: 30.3725 },
    description: "Физические лаборатории и специализированные исследовательские практикумы.",
    typicalClasses: "Лабораторные работы по общей физике",
    entranceTips: "Вход через двор со стороны 3-го корпуса.",
    hasDining: false,
  },
  {
    id: "b11",
    number: "11",
    name: "11-й учебный корпус",
    shortName: "11 к. (Аудиторный)",
    category: "study",
    address: "Политехническая ул., 29, корп. 11",
    coords: { lat: 60.0019, lng: 30.3781 },
    description: "Учебные поточные аудитории и вычислительные лаборатории.",
    typicalClasses: "Семинары, практики, иностранные языки",
    entranceTips: "Вход со стороны ул. Гидротехников.",
    hasDining: true,
  },
  {
    id: "gidro",
    number: "Гидро",
    name: "Гидрокорпус-1 и Гидрокорпус-2",
    shortName: "Гидрокорпус",
    category: "study",
    address: "Политехническая ул., 29, корп. 1-2",
    coords: { lat: 60.0042, lng: 30.3775 },
    description: "Инженерно-строительный институт и гидравлические лаборатории.",
    typicalClasses: "Сопромат, гидравлика, строительная механика",
    entranceTips: "Вход рядом со знаменитой водонапорной башней Политеха.",
    hasDining: true,
  },
  {
    id: "sport",
    number: "СК",
    name: "Спорткомплекс «Политехник»",
    shortName: "Спорткомплекс",
    category: "sport",
    address: "Политехническая ул., 27",
    coords: { lat: 60.0011, lng: 30.3698 },
    description: "Главная спортивная арена СПбПУ: бассейн 50м, стадион, тренажёрные залы, секции.",
    typicalClasses: "Физическая культура, сдача нормативов, спортивные секции",
    entranceTips: "Вход с ул. Политехническая напротив парка.",
    hasDining: false,
  },
  {
    id: "imop",
    number: "15",
    name: "15-й корпус (ИМОП)",
    shortName: "15 к. (ИМОП)",
    category: "study",
    address: "Гражданский пр., 28",
    coords: { lat: 60.0058, lng: 30.3951 },
    description: "Институт международных образовательных программ. Языковые кафедры.",
    typicalClasses: "Иностранные языки, международные программы",
    entranceTips: "Отдельный кампус у метро «Академическая». Вход с Гражданского проспекта.",
    hasDining: true,
  },
  {
    id: "metro_poly",
    number: "М",
    name: "Станция метро «Политехническая»",
    shortName: "Метро Политехническая",
    category: "transport",
    address: "Политехническая пл.",
    coords: { lat: 60.0089, lng: 30.3712 },
    description: "Основной выход к ГУК, 1-му, 2-му и 3-му корпусам (красная 1-я линия метро).",
    typicalClasses: "Транспортный узел",
    entranceTips: "Выход из метро прямо в парк Политеха.",
    hasDining: true,
  },
  {
    id: "metro_acad",
    number: "М",
    name: "Станция метро «Академическая»",
    shortName: "Метро Академическая",
    category: "transport",
    address: "Гражданский пр. / пр. Науки",
    coords: { lat: 60.0125, lng: 30.3962 },
    description: "Ближайшая станция к ИМОП (15-й корпус) и студенческому городку на ул. Хлопина.",
    typicalClasses: "Транспортный узел",
    entranceTips: "Пешком 5 минут до 15-го корпуса (Гражданский, 28).",
    hasDining: true,
  },
];

export type CampusMapModalProps = {
  visible: boolean;
  onClose: () => void;
  initialBuildingNumber?: string;
};

export const CampusMapModal: React.FC<CampusMapModalProps> = ({
  visible,
  onClose,
  initialBuildingNumber,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding>(
    () =>
      CAMPUS_BUILDINGS.find((b) => b.number === initialBuildingNumber) ||
      CAMPUS_BUILDINGS[0], // default 3rd building
  );

  const filteredBuildings = useMemo(() => {
    return CAMPUS_BUILDINGS.filter((b) => {
      const matchCat =
        selectedCategory === "all" ||
        (selectedCategory === "study" && b.category === "study") ||
        (selectedCategory === "food" && b.hasDining) ||
        (selectedCategory === "sport" && b.category === "sport") ||
        (selectedCategory === "transport" && b.category === "transport");

      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        b.name.toLowerCase().includes(q) ||
        b.number.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.typicalClasses.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  const handleOpenNavigation = (building: CampusBuilding) => {
    const query = encodeURIComponent(`СПбПУ ${building.name} ${building.address}`);
    const yandexUrl = `https://yandex.ru/maps/?text=${query}`;
    Linking.openURL(yandexUrl).catch(() => {});
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
              <Text style={styles.title}>Карта кампуса СПбПУ</Text>
              <Text style={styles.subtitle}>
                Корпуса, аудитории, столовые и входы Политеха
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Закрыть карту"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск корпуса (3, НИК, ГУК, столовая)..."
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
              { id: "study", label: "Учебные" },
              { id: "food", label: "Столовые" },
              { id: "sport", label: "Спорт" },
              { id: "transport", label: "Метро" },
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

          {/* Visual Campus Park Layout Schematic */}
          <View style={styles.mapVisualContainer}>
            <View style={styles.parkBackground}>
              <View style={styles.parkTreeRow}>
                <Text style={styles.parkLabel}>Парк Политехнического университета</Text>
              </View>

              {/* Interactive building badges on the mini-map */}
              <View style={styles.miniMapGrid}>
                {CAMPUS_BUILDINGS.slice(0, 9).map((b) => {
                  const isSelected = selectedBuilding.id === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      onPress={() => setSelectedBuilding(b)}
                      style={[
                        styles.mapPin,
                        isSelected && styles.mapPinSelected,
                        b.id === "b3" && styles.mapPinHome,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.mapPinText,
                          isSelected && styles.mapPinTextSelected,
                        ]}
                      >
                        {b.number}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Detail Card for Selected Building */}
          {selectedBuilding && (
            <View style={styles.buildingDetailCard}>
              <View style={styles.detailHeaderRow}>
                <View style={styles.detailTitleCol}>
                  <View style={styles.numberBadge}>
                    <Text style={styles.numberBadgeText}>
                      {selectedBuilding.number}
                    </Text>
                  </View>
                  <View style={styles.titleTextCol}>
                    <Text style={styles.detailTitleText}>
                      {selectedBuilding.name}
                    </Text>
                    <Text style={styles.detailAddressText}>
                      {selectedBuilding.address}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleOpenNavigation(selectedBuilding)}
                  style={styles.routeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Открыть в Яндекс Картах"
                >
                  <Text style={styles.routeBtnText}>Маршрут ↗</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.detailScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Занятия и институты:</Text>
                  <Text style={styles.infoContent}>
                    {selectedBuilding.typicalClasses}
                  </Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Как войти и ориентироваться:</Text>
                  <Text style={styles.infoContent}>
                    {selectedBuilding.entranceTips}
                  </Text>
                </View>

                {selectedBuilding.floorsInfo && (
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Этажи и навигация:</Text>
                    <Text style={styles.infoContent}>
                      {selectedBuilding.floorsInfo}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Quick List of All Campus Buildings */}
          <ScrollView
            style={styles.buildingsListScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.buildingsListContent}
          >
            {filteredBuildings.map((b) => {
              const isSelected = selectedBuilding.id === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setSelectedBuilding(b)}
                  style={[
                    styles.buildingPill,
                    isSelected && styles.buildingPillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.buildingPillNumber,
                      isSelected && styles.buildingPillNumberSelected,
                    ]}
                  >
                    {b.number}
                  </Text>
                  <Text
                    style={[
                      styles.buildingPillName,
                      isSelected && styles.buildingPillNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {b.shortName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
  mapVisualContainer: {
    height: 110,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  parkBackground: {
    flex: 1,
    backgroundColor: "#132338",
    padding: 10,
    justifyContent: "space-between",
  },
  parkTreeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  parkLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  miniMapGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  mapPin: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
  },
  mapPinSelected: {
    backgroundColor: "#2563eb",
  },
  mapPinHome: {
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  mapPinText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#cbd5e1",
  },
  mapPinTextSelected: {
    color: "#ffffff",
  },
  buildingDetailCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  detailTitleCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  titleTextCol: {
    flex: 1,
  },
  detailTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  detailAddressText: {
    fontSize: 12,
    color: "#8a9bb5",
    marginTop: 1,
  },
  routeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.3)",
  },
  routeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#93c5fd",
  },
  detailScroll: {
    maxHeight: 120,
  },
  infoBlock: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoContent: {
    fontSize: 13,
    color: "#e2e8f0",
    lineHeight: 18,
  },
  buildingsListScroll: {
    marginTop: 4,
  },
  buildingsListContent: {
    gap: 8,
    paddingVertical: 4,
  },
  buildingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  buildingPillSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    borderColor: "#3b82f6",
  },
  buildingPillNumber: {
    fontSize: 12,
    fontWeight: "800",
    color: "#93c5fd",
  },
  buildingPillNumberSelected: {
    color: "#ffffff",
  },
  buildingPillName: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  buildingPillNameSelected: {
    color: "#ffffff",
  },
});
