import { StyleSheet, View, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function InfoScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <Ionicons name="information-circle" size={40} color="#fff" />
          <ThemedText style={styles.headerTitle}>Informacion</ThemedText>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={22} color="#7C3AED" />
            <ThemedText style={styles.cardTitle}>Uso responsable</ThemedText>
          </View>
          <ThemedText style={styles.cardText}>
            Esta app es para uso personal. Respeta los derechos de autor y la
            privacidad de los creadores de contenido.
          </ThemedText>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Ionicons name="help-circle" size={22} color="#3B82F6" />
            <ThemedText style={styles.cardTitle}>Como funciona</ThemedText>
          </View>
          <ThemedText style={styles.cardText}>
            La app toma el enlace publico del Reel de Instagram, obtiene el video
            y lo guarda directamente en la galeria de tu dispositivo.
          </ThemedText>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Ionicons name="alert-circle" size={22} color="#F59E0B" />
            <ThemedText style={styles.cardTitle}>Importante</ThemedText>
          </View>
          <ThemedText style={styles.cardText}>
            Solo se pueden descargar Reels de cuentas publicas. Los Reels de
            cuentas privadas no estan disponibles.
          </ThemedText>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Ionicons name="code-slash" size={22} color="#10B981" />
            <ThemedText style={styles.cardTitle}>Version</ThemedText>
          </View>
          <ThemedText style={styles.cardText}>Reel Downloader v1.0.0</ThemedText>
        </View>
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
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 10,
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
      android: {
        elevation: 2,
      },
    }),
  },
  cardDark: {
    backgroundColor: '#1E1E2E',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
});
