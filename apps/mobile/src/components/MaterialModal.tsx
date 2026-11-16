import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import type { DownloadedMaterial } from "@studentvalue/mobile-contracts";
import {
  downloadMaterial,
  readLocalMaterialContent,
  deleteLocalMaterial,
  fetchMaterialMetadata,
  type MaterialMetadata,
  type LocalMaterialReadResult,
} from "../materials/downloader";
import { getTimetableRepository } from "../storage/repository";

interface MaterialModalProps {
  visible: boolean;
  materialId: string | null;
  userId: string | null;
  onClose: () => void;
}

export const MaterialModal: React.FC<MaterialModalProps> = ({
  visible,
  materialId,
  userId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MaterialMetadata | null>(null);
  const [downloaded, setDownloaded] = useState<DownloadedMaterial | null>(null);
  const [readResult, setReadResult] = useState<LocalMaterialReadResult | null>(null);
  const [viewingFile, setViewingFile] = useState(false);

  useEffect(() => {
    if (!visible || !materialId || !userId) {
      setMetadata(null);
      setDownloaded(null);
      setReadResult(null);
      setViewingFile(false);
      setError(null);
      return;
    }

    let active = true;
    const checkState = async () => {
      setLoading(true);
      setError(null);
      try {
        const repo = getTimetableRepository();
        const local = await repo.getDownloadedMaterial(userId, materialId);
        if (active) {
          setDownloaded(local);
        }

        // Try to fetch latest metadata if online
        try {
          const meta = await fetchMaterialMetadata(materialId);
          if (active) setMetadata(meta);
        } catch (metaErr) {
          // If offline and have local copy, metadata isn't strictly required
          if (!local && active) {
            setError(metaErr instanceof Error ? metaErr.message : "Ошибка загрузки");
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    checkState();
    return () => {
      active = false;
    };
  }, [visible, materialId, userId]);

  const handleDownload = async () => {
    if (!materialId || !userId) return;
    setDownloading(true);
    setError(null);
    try {
      const result = await downloadMaterial(materialId);
      setDownloaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка скачивания файла");
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenOffline = async () => {
    if (!materialId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await readLocalMaterialContent(userId, materialId);
      setReadResult(result);
      setViewingFile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть файл");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Удаление файла",
      "Удалить сохранённый материал с устройства? При необходимости его можно будет скачать снова.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            if (!materialId || !userId) return;
            await deleteLocalMaterial(userId, materialId);
            setDownloaded(null);
            setReadResult(null);
            setViewingFile(false);
          },
        },
      ],
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {viewingFile ? (
            // Full screen file reader
            <View style={styles.readerContainer}>
              <View style={styles.readerHeader}>
                <Text style={styles.readerTitle} numberOfLines={1}>
                  {downloaded?.filename ?? "Документ"}
                </Text>
                <TouchableOpacity
                  onPress={() => setViewingFile(false)}
                  style={styles.closeReaderButton}
                >
                  <Text style={styles.closeReaderText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.readerBody}>
                {readResult?.isBinary ? (
                  <View style={styles.binaryContainer}>
                    <Text style={styles.binaryTitle}>📄 Бинарный документ</Text>
                    <Text style={styles.binarySubtitle}>
                      {readResult.filename} ({readResult.mimeType || "application/octet-stream"})
                    </Text>
                    <Text style={styles.binaryDesc}>
                      Файл загружен и верифицирован ({readResult.byteSize} байт). Сохранён в изолированной памяти устройства для работы без сети.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.readerText}>{readResult?.content}</Text>
                )}
              </ScrollView>
            </View>
          ) : (
            // Material overview & actions
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Учебный материал</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.subtext}>Проверка файла...</Text>
                </View>
              ) : (
                <View style={styles.infoContainer}>
                  <Text style={styles.materialTitle}>
                    {metadata?.title ?? downloaded?.filename ?? "Методические указания"}
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Файл:</Text>
                    <Text style={styles.value}>
                      {metadata?.filename ?? downloaded?.filename ?? "Загрузка..."}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.label}>Размер:</Text>
                    <Text style={styles.value}>
                      {metadata?.byteSize
                        ? `${metadata.byteSize} байт (${Math.ceil(metadata.byteSize / 1024)} КБ)`
                        : downloaded?.byteSize
                          ? `${downloaded.byteSize} байт`
                          : "—"}
                    </Text>
                  </View>

                  {downloaded ? (
                    <View style={styles.statusBoxSuccess}>
                      <Text style={styles.statusTextSuccess}>
                        ✓ Сохранено в памяти устройства
                      </Text>
                      <Text style={styles.shaText} numberOfLines={1}>
                        SHA-256: {downloaded.sha256}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.statusBoxPending}>
                      <Text style={styles.statusTextPending}>
                        Файл ещё не скачан на устройство
                      </Text>
                    </View>
                  )}

                  {error && <Text style={styles.errorText}>{error}</Text>}

                  <View style={styles.actionsContainer}>
                    {downloaded ? (
                      <>
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={handleOpenOffline}
                          accessibilityLabel="Открыть документ офлайн"
                        >
                          <Text style={styles.primaryButtonText}>
                            📖 Читать офлайн
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={handleDelete}
                          accessibilityLabel="Удалить файл с устройства"
                        >
                          <Text style={styles.deleteButtonText}>
                            Удалить с устройства
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          downloading && styles.buttonDisabled,
                        ]}
                        onPress={handleDownload}
                        disabled={downloading}
                        accessibilityLabel="Скачать материал на устройство"
                      >
                        {downloading ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            ⬇ Скачать для офлайн-доступа
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#16253d",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#223554",
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0f4f8",
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#223554",
  },
  closeText: {
    fontSize: 16,
    color: "#8a9bb5",
    fontWeight: "bold",
  },
  centerContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },
  subtext: {
    marginTop: 10,
    fontSize: 14,
    color: "#8a9bb5",
  },
  infoContainer: {
    marginTop: 4,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#dbeafe",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  label: {
    fontSize: 13,
    color: "#8a9bb5",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f0f4f8",
    maxWidth: "65%",
  },
  statusBoxSuccess: {
    marginTop: 14,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusTextSuccess: {
    fontSize: 12,
    fontWeight: "700",
    color: "#34d399",
  },
  shaText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#6ee7b7",
    marginTop: 4,
  },
  statusBoxPending: {
    marginTop: 14,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusTextPending: {
    fontSize: 12,
    color: "#fbbf24",
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: "#f87171",
  },
  actionsContainer: {
    marginTop: 20,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f87171",
  },
  readerContainer: {
    flex: 1,
    minHeight: 400,
  },
  readerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  readerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f0f4f8",
    maxWidth: "80%",
  },
  closeReaderButton: {
    padding: 6,
  },
  closeReaderText: {
    fontSize: 16,
    color: "#8a9bb5",
    fontWeight: "bold",
  },
  readerBody: {
    marginTop: 12,
    maxHeight: 450,
  },
  readerText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "monospace",
    color: "#dbeafe",
  },
  binaryContainer: {
    padding: 16,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    alignItems: "center",
  },
  binaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#93c5fd",
    marginBottom: 6,
  },
  binarySubtitle: {
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 12,
    textAlign: "center",
  },
  binaryDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94a3b8",
    textAlign: "center",
  },
});
