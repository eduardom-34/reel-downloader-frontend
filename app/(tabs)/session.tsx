import { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSession, type InstagramCookie } from '@/contexts/session-context';

export default function SessionScreen() {
  const { isLoggedIn, username, saveCookies, clearSession } = useSession();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCookies, setManualCookies] = useState('');

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesion',
      'Se eliminaran las cookies guardadas. Ya no podras descargar Reels privados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesion',
          style: 'destructive',
          onPress: () => clearSession(),
        },
      ],
    );
  };

  const handleManualSave = async () => {
    const text = manualCookies.trim();
    if (!text) {
      Alert.alert('Error', 'Pega tus cookies primero.');
      return;
    }

    try {
      const cookies: InstagramCookie[] = [];

      const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 7) {
          cookies.push({
            name: parts[5].trim(),
            value: parts[6].trim(),
            domain: parts[0].trim(),
            path: parts[2].trim(),
            secure: parts[3].trim().toUpperCase() === 'TRUE',
            httpOnly: parts[5].trim() === 'sessionid',
          });
        }
      }

      if (cookies.length === 0) {
        const pairs = text.split(';').map((p) => p.trim()).filter(Boolean);
        for (const pair of pairs) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            cookies.push({
              name: pair.substring(0, eqIdx).trim(),
              value: pair.substring(eqIdx + 1).trim(),
              domain: '.instagram.com',
              path: '/',
              secure: true,
              httpOnly: pair.substring(0, eqIdx).trim() === 'sessionid',
            });
          }
        }
      }

      if (cookies.length === 0) {
        Alert.alert('Error', 'No se pudieron parsear las cookies. Verifica el formato.');
        return;
      }

      const hasSession = cookies.some((c) => c.name === 'sessionid' && c.value);
      if (!hasSession) {
        Alert.alert('Error', 'No se encontro la cookie "sessionid". Asegurate de incluirla.');
        return;
      }

      const dsUser = cookies.find((c) => c.name === 'ds_user_id');
      await saveCookies(cookies, dsUser?.value ?? null);
      setManualCookies('');
      setShowManualInput(false);
      Alert.alert('Listo!', 'Cookies guardadas correctamente.');
    } catch {
      Alert.alert('Error', 'Formato de cookies no valido.');
    }
  };

  // -- Manual cookie input --
  if (showManualInput) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            onPress={() => setShowManualInput(false)}
            style={styles.webViewBackButton}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.webViewTitle}>Pegar cookies</ThemedText>
          <TouchableOpacity onPress={handleManualSave} style={styles.webViewDoneButton}>
            <ThemedText style={styles.webViewDoneText}>Guardar</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <ThemedText style={styles.infoCardTitle}>Instrucciones</ThemedText>
            </View>
            <ThemedText style={styles.infoCardText}>
              1. Abre Instagram en tu navegador de PC{'\n'}
              2. Inicia sesion en tu cuenta{'\n'}
              3. Instala la extension "Get cookies.txt LOCALLY"{'\n'}
              4. Exporta las cookies de instagram.com{'\n'}
              5. Copia todo el contenido y pegalo abajo
            </ThemedText>
          </View>

          <ThemedText style={styles.manualLabel}>Cookies (formato Netscape o key=value)</ThemedText>
          <TextInput
            style={[
              styles.manualInput,
              isDark && styles.manualInputDark,
              { color: textColor },
            ]}
            multiline
            placeholder={'# Netscape format\n.instagram.com\tTRUE\t/\tTRUE\t0\tsessionid\tABC123\n\no tambien:\nsessionid=ABC123; ds_user_id=12345; csrftoken=XYZ'}
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={manualCookies}
            onChangeText={setManualCookies}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleManualSave}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={20} color="#fff" />
            <ThemedText style={styles.loginButtonText}>Guardar cookies</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  }

  // -- Main screen --
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <Ionicons name="person-circle" size={36} color="#fff" />
          <ThemedText style={styles.headerTitle}>Sesion</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Inicia sesion para descargar Reels privados
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoggedIn ? (
          <>
            <View style={[styles.card, isDark && styles.cardDark]}>
              <View style={styles.loggedInHeader}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="checkmark" size={28} color="#fff" />
                </View>
                <View style={styles.loggedInInfo}>
                  <ThemedText style={styles.loggedInTitle}>Sesion activa</ThemedText>
                  {username && (
                    <ThemedText style={styles.loggedInUser}>ID: {username}</ThemedText>
                  )}
                </View>
              </View>

              <ThemedText style={styles.loggedInDescription}>
                Puedes descargar Reels de cuentas privadas que sigas.
              </ThemedText>

              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                <ThemedText style={styles.logoutText}>Cerrar sesion</ThemedText>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.card, isDark && styles.cardDark]}>
              <View style={styles.lockedIcon}>
                <Ionicons name="lock-closed" size={40} color={isDark ? '#9CA3AF' : '#D1D5DB'} />
              </View>
              <ThemedText style={styles.noSessionTitle}>Sin sesion</ThemedText>
              <ThemedText style={styles.noSessionDescription}>
                Inicia sesion con Instagram para acceder a Reels de cuentas privadas.
              </ThemedText>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => setShowManualInput(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="clipboard-outline" size={22} color="#fff" />
                <ThemedText style={styles.loginButtonText}>
                  Agregar cookies de Instagram
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                <ThemedText style={styles.infoCardTitle}>Seguridad</ThemedText>
              </View>
              <ThemedText style={styles.infoCardText}>
                Las cookies se guardan de forma segura en tu dispositivo y se envian al servidor solo para autenticar las descargas.
              </ThemedText>
            </View>
          </>
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
    overflow: 'hidden',
  },
  headerGradient: {
    backgroundColor: '#7C3AED',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 32,
  },

  /* Cards */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  cardDark: {
    backgroundColor: '#1E1E2E',
  },

  /* Logged in */
  loggedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 14,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedInInfo: {
    flex: 1,
  },
  loggedInTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loggedInUser: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  loggedInDescription: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.7,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Logged out */
  lockedIcon: {
    marginBottom: 16,
  },
  noSessionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  noSessionDescription: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1306C',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#E1306C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#F3E8FF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  manualButtonDark: {
    backgroundColor: '#2D2044',
  },
  manualButtonText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '600',
  },
  manualButtonTextDark: {
    color: '#C084FC',
  },
  warningCard: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  warningCardDark: {
    backgroundColor: '#422006',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    color: '#92400E',
  },

  /* Info cards */
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  infoCardDark: {
    backgroundColor: '#1E1E2E',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoCardText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },

  /* Manual input */
  manualLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.6,
    marginBottom: 8,
  },
  manualInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 180,
    marginBottom: 16,
  },
  manualInputDark: {
    backgroundColor: '#2A2A3E',
    borderColor: '#3A3A50',
  },

  /* WebView */
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#7C3AED',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  webViewBackButton: {
    padding: 4,
  },
  webViewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  webViewDoneButton: {
    padding: 4,
  },
  webViewDoneText: {
    color: '#E9D5FF',
    fontSize: 15,
    fontWeight: '600',
  },
  webViewLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  webView: {
    flex: 1,
  },
});
