/** @format */

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { File as ExpoFile, Paths } from "expo-file-system";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  ApiError,
  checkServerHealth,
  downloadReelBinary,
  fetchReelInfo,
  type ReelInfo,
} from "@/constants/api";
import { useSession } from "@/contexts/session-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useRouter } from "expo-router";

type AppStatus =
  | "idle"
  | "checking_server"
  | "fetching_info"
  | "preview"
  | "downloading"
  | "saving"
  | "success"
  | "error";

const INSTAGRAM_URL_REGEX =
  /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function HomeScreen() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<AppStatus>("idle");
  const [reelInfo, setReelInfo] = useState<ReelInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [is403, setIs403] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const colorScheme = useColorScheme() ?? "light";
  const textColor = useThemeColor({}, "text");
  const iconColor = useThemeColor({}, "icon");
  const isDark = colorScheme === "dark";

  const { isLoggedIn, cookiesForApi } = useSession();
  const router = useRouter();

  const searchScale = useSharedValue(1);
  const searchAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: searchScale.value }],
  }));

  const downloadScale = useSharedValue(1);
  const downloadAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: downloadScale.value }],
  }));

  useEffect(() => {
    checkServerHealth().then(setServerOnline);
  }, []);

  const animateButton = (sharedValue: SharedValue<number>) => {
    sharedValue.value = withSequence(
      withSpring(0.93, { damping: 15 }),
      withSpring(1, { damping: 10 }),
    );
  };

  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setUrl(clipboardContent.trim());
        setErrorMessage("");
      }
    } catch {
      Alert.alert("Error", "No se pudo acceder al portapapeles.");
    }
  };

  const handleClear = () => {
    setUrl("");
    setStatus("idle");
    setReelInfo(null);
    setErrorMessage("");
    setIs403(false);
    inputRef.current?.focus();
  };

  const handleFetchInfo = async () => {
    Keyboard.dismiss();
    animateButton(searchScale);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setErrorMessage("Por favor, ingresa una URL.");
      return;
    }
    if (!INSTAGRAM_URL_REGEX.test(trimmedUrl)) {
      setErrorMessage("URL no valida. Ingresa un enlace de Instagram Reel.");
      return;
    }

    setErrorMessage("");
    setReelInfo(null);
    setIs403(false);
    setStatus("fetching_info");

    try {
      const cookies = cookiesForApi();
      const info = await fetchReelInfo(trimmedUrl, cookies);
      setReelInfo(info);
      setStatus("preview");
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setIs403(err.status === 403);
      } else {
        setErrorMessage(
          "No se pudo conectar al servidor. Verifica tu conexion.",
        );
      }
    }
  };

  const handleDownload = async () => {
    if (!reelInfo) return;
    animateButton(downloadScale);

    setStatus("downloading");
    setErrorMessage("");

    try {
      const { status: permStatus } =
        await MediaLibrary.requestPermissionsAsync(true);
      if (permStatus !== "granted") {
        throw new Error("Se necesitan permisos para guardar el video.");
      }

      const videoUrl = reelInfo.video_url;
      const safeName = (reelInfo.title || "reel")
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .substring(0, 60);
      const fileName = `${safeName}_${Date.now()}.mp4`;
      const destination = new ExpoFile(Paths.cache, fileName);

      let fileUri: string | null = null;

      try {
        const downloaded = await ExpoFile.downloadFileAsync(
          videoUrl,
          destination,
          {
            idempotent: true,
          },
        );
        fileUri = downloaded.uri;
      } catch {
        const cookies = cookiesForApi();
        const { blob, filename } = await downloadReelBinary(
          url.trim(),
          cookies,
        );
        const fallbackDest = new ExpoFile(Paths.cache, filename);
        const buffer = await blob.arrayBuffer();
        fallbackDest.write(new Uint8Array(buffer));
        fileUri = fallbackDest.uri;
      }

      if (!fileUri) {
        throw new Error("La descarga fallo.");
      }

      setStatus("saving");
      await MediaLibrary.saveToLibraryAsync(fileUri);

      try {
        const tempFile = new ExpoFile(fileUri);
        if (tempFile.exists) tempFile.delete();
      } catch {
        // ignore cleanup errors
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Error inesperado al descargar.");
      }
    }
  };

  const handleRetry = () => {
    if (reelInfo) {
      handleDownload();
    } else {
      handleFetchInfo();
    }
  };

  const handleNewDownload = () => {
    setUrl("");
    setStatus("idle");
    setReelInfo(null);
    setErrorMessage("");
    setIs403(false);
    inputRef.current?.focus();
  };

  const isLoading = [
    "checking_server",
    "fetching_info",
    "downloading",
    "saving",
  ].includes(status);
  const showPreview =
    reelInfo &&
    ["preview", "downloading", "saving", "success"].includes(status);

  const getStatusBadge = () => {
    switch (status) {
      case "fetching_info":
        return {
          text: "Obteniendo informacion...",
          color: "#F59E0B",
          icon: "hourglass-outline" as const,
        };
      case "downloading":
        return {
          text: "Descargando video...",
          color: "#3B82F6",
          icon: "cloud-download-outline" as const,
        };
      case "saving":
        return {
          text: "Guardando en galeria...",
          color: "#8B5CF6",
          icon: "save-outline" as const,
        };
      case "success":
        return {
          text: "Descarga completada!",
          color: "#10B981",
          icon: "checkmark-circle" as const,
        };
      case "error":
        return {
          text: errorMessage || "Error",
          color: "#EF4444",
          icon: "close-circle" as const,
        };
      default:
        return null;
    }
  };

  const badge = getStatusBadge();

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <Ionicons name="logo-instagram" size={36} color="#fff" />
          <ThemedText style={styles.headerTitle}>Reel Downloader</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Descarga Reels de Instagram facilmente
          </ThemedText>
          <View style={styles.badgesRow}>
            {serverOnline !== null && (
              <View style={styles.serverBadge}>
                <View
                  style={[
                    styles.serverDot,
                    { backgroundColor: serverOnline ? "#34D399" : "#F87171" },
                  ]}
                />
                <ThemedText style={styles.serverText}>
                  {serverOnline ? "Conectado" : "Sin servidor"}
                </ThemedText>
              </View>
            )}
            <View style={styles.serverBadge}>
              <View
                style={[
                  styles.serverDot,
                  { backgroundColor: isLoggedIn ? "#34D399" : "#F59E0B" },
                ]}
              />
              <ThemedText style={styles.serverText}>
                {isLoggedIn ? "Sesion activa" : "Sin sesion"}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* URL Input Card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <ThemedText style={styles.cardLabel}>Enlace del Reel</ThemedText>

          <View
            style={[styles.inputContainer, isDark && styles.inputContainerDark]}
          >
            <Ionicons
              name="link-outline"
              size={20}
              color={iconColor}
              style={styles.inputIcon}
            />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: textColor }]}
              placeholder="https://www.instagram.com/reel/..."
              placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                setErrorMessage("");
                if (status === "error") setStatus("idle");
                if (status === "preview" || status === "success") {
                  setStatus("idle");
                  setReelInfo(null);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              onSubmitEditing={handleFetchInfo}
              editable={!isLoading}
              selectTextOnFocus
            />
            {url.length > 0 && !isLoading && (
              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={iconColor} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.pasteButton, isDark && styles.pasteButtonDark]}
              onPress={handlePaste}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Ionicons
                name="clipboard-outline"
                size={18}
                color={isDark ? "#C084FC" : "#7C3AED"}
              />
              <ThemedText
                style={[styles.pasteText, isDark && styles.pasteTextDark]}
              >
                Pegar
              </ThemedText>
            </TouchableOpacity>
          </View>

          {errorMessage && status !== "error" && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          )}
        </View>

        {/* Search Button (only when no preview yet) */}
        {!showPreview && status !== "success" && (
          <Animated.View style={searchAnimatedStyle}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading && styles.primaryButtonDisabled,
              ]}
              onPress={handleFetchInfo}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {status === "fetching_info" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="search-outline" size={22} color="#fff" />
              )}
              <ThemedText style={styles.primaryButtonText}>
                {status === "fetching_info" ? "Buscando..." : "Buscar Reel"}
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Preview Card */}
        {showPreview && reelInfo && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
          >
            <View
              style={[styles.previewCard, isDark && styles.previewCardDark]}
            >
              <View style={styles.thumbnailContainer}>
                <Image
                  source={{ uri: reelInfo.thumbnail }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  transition={300}
                />
                <View style={styles.durationBadge}>
                  <Ionicons name="time-outline" size={12} color="#fff" />
                  <ThemedText style={styles.durationText}>
                    {formatDuration(reelInfo.duration)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.previewInfo}>
                <ThemedText style={styles.previewTitle} numberOfLines={2}>
                  {reelInfo.title}
                </ThemedText>
                <View style={styles.uploaderRow}>
                  <Ionicons
                    name="person-circle-outline"
                    size={16}
                    color={iconColor}
                  />
                  <ThemedText style={styles.uploaderText}>
                    @{reelInfo.uploader}
                  </ThemedText>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Download Button (only when preview is shown) */}
        {showPreview && status !== "success" && (
          <Animated.View style={downloadAnimatedStyle}>
            <TouchableOpacity
              style={[
                styles.downloadButton,
                (status === "downloading" || status === "saving") &&
                  styles.downloadButtonDisabled,
              ]}
              onPress={handleDownload}
              disabled={status === "downloading" || status === "saving"}
              activeOpacity={0.85}
            >
              {status === "downloading" || status === "saving" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={24} color="#fff" />
              )}
              <ThemedText style={styles.downloadButtonText}>
                {status === "downloading"
                  ? "Descargando..."
                  : status === "saving"
                    ? "Guardando..."
                    : "Descargar Reel"}
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Status Badge */}
        {badge && (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={[styles.statusCard, isDark && styles.statusCardDark]}>
              <View style={styles.statusHeader}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={badge.color} />
                ) : (
                  <Ionicons name={badge.icon} size={22} color={badge.color} />
                )}
                <ThemedText style={[styles.statusText, { color: badge.color }]}>
                  {badge.text}
                </ThemedText>
              </View>

              {status === "success" && (
                <View style={styles.successContent}>
                  <ThemedText style={styles.successHint}>
                    El video se guardo en tu galeria.
                  </ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.newDownloadButton,
                      isDark && styles.newDownloadButtonDark,
                    ]}
                    onPress={handleNewDownload}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color={isDark ? "#C084FC" : "#7C3AED"}
                    />
                    <ThemedText
                      style={[
                        styles.newDownloadText,
                        isDark && styles.newDownloadTextDark,
                      ]}
                    >
                      Nueva descarga
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}

              {status === "error" && (
                <View style={styles.errorActions}>
                  <TouchableOpacity
                    onPress={handleRetry}
                    style={styles.retryButton}
                  >
                    <Ionicons name="refresh" size={16} color="#EF4444" />
                    <ThemedText style={styles.retryText}>Reintentar</ThemedText>
                  </TouchableOpacity>

                  {is403 && !isLoggedIn && (
                    <TouchableOpacity
                      onPress={() => router.push("/session" as never)}
                      style={styles.loginHintButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="log-in-outline"
                        size={16}
                        color="#7C3AED"
                      />
                      <ThemedText style={styles.loginHintText}>
                        Iniciar sesion
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Instructions */}
        {status === "idle" && !errorMessage && (
          <View
            style={[
              styles.instructionsCard,
              isDark && styles.instructionsCardDark,
            ]}
          >
            <ThemedText style={styles.instructionsTitle}>Como usar</ThemedText>
            {[
              "Abre Instagram y copia el enlace del Reel",
              'Pega el enlace y presiona "Buscar Reel"',
              "Revisa la vista previa y descarga!",
            ].map((text, i) => (
              <View key={i} style={styles.instructionStep}>
                <View
                  style={[
                    styles.stepNumber,
                    { backgroundColor: isDark ? "#7C3AED" : "#E9D5FF" },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.stepNumberText,
                      { color: isDark ? "#fff" : "#7C3AED" },
                    ]}
                  >
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText style={styles.instructionText}>{text}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    overflow: "hidden",
  },
  headerGradient: {
    backgroundColor: "#7C3AED",
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  serverBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serverText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  cardDark: {
    backgroundColor: "#1E1E2E",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.6,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    height: 52,
  },
  inputContainerDark: {
    backgroundColor: "#2A2A3E",
    borderColor: "#3A3A50",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  pasteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  pasteButtonDark: {
    backgroundColor: "#2D2044",
  },
  pasteText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7C3AED",
  },
  pasteTextDark: {
    color: "#C084FC",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    flex: 1,
  },

  /* Search / primary button */
  primaryButton: {
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  primaryButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  /* Preview card */
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  previewCardDark: {
    backgroundColor: "#1E1E2E",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1a1a2e",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  previewInfo: {
    padding: 16,
    gap: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  uploaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  uploaderText: {
    fontSize: 14,
    opacity: 0.7,
  },

  /* Download button */
  downloadButton: {
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  downloadButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  /* Status card */
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  statusCardDark: {
    backgroundColor: "#1E1E2E",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  successContent: {
    marginTop: 10,
    gap: 12,
  },
  successHint: {
    fontSize: 13,
    opacity: 0.6,
  },
  newDownloadButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  newDownloadButtonDark: {
    backgroundColor: "#2D2044",
  },
  newDownloadText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7C3AED",
  },
  newDownloadTextDark: {
    color: "#C084FC",
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 16,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  retryText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
  loginHintButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  loginHintText: {
    color: "#7C3AED",
    fontSize: 13,
    fontWeight: "600",
  },

  /* Instructions */
  instructionsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  instructionsCardDark: {
    backgroundColor: "#1E1E2E",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: "700",
  },
  instructionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
