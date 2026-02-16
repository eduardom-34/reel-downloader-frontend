import { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHistory, type DownloadRecord } from '@/contexts/history-context';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;

  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function HistoryItem({
  item,
  isDark,
  onCopyUrl,
  onDelete,
}: {
  item: DownloadRecord;
  isDark: boolean;
  onCopyUrl: (url: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={[styles.historyCard, isDark && styles.historyCardDark]}>
      <View style={styles.historyRow}>
        <View style={styles.thumbContainer}>
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.thumb}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.thumbDuration}>
            <ThemedText style={styles.thumbDurationText}>
              {formatDuration(item.duration)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.historyInfo}>
          <ThemedText style={styles.historyTitle} numberOfLines={2}>
            {item.title || 'Sin titulo'}
          </ThemedText>
          <View style={styles.historyMeta}>
            <Ionicons name="person-outline" size={12} color="#9CA3AF" />
            <ThemedText style={styles.historyUploader}>
              @{item.uploader}
            </ThemedText>
          </View>
          <ThemedText style={styles.historyDate}>
            {formatDate(item.downloadedAt)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.historyActions}>
        <TouchableOpacity
          onPress={() => onCopyUrl(item.url)}
          style={[styles.actionChip, isDark && styles.actionChipDark]}
          activeOpacity={0.7}
        >
          <Ionicons name="copy-outline" size={14} color={isDark ? '#C084FC' : '#7C3AED'} />
          <ThemedText style={[styles.actionChipText, isDark && styles.actionChipTextDark]}>
            Copiar URL
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          style={styles.deleteChip}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { history, clearHistory, removeRecord } = useHistory();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCopyUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('Copiado', 'URL copiada al portapapeles.');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar', 'Eliminar este registro del historial?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => removeRecord(id),
      },
    ]);
  };

  const handleClearAll = () => {
    if (history.length === 0) return;
    Alert.alert(
      'Borrar historial',
      `Se eliminaran ${history.length} registros. Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            setRefreshKey((k) => k + 1);
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <Ionicons name="time" size={36} color="#fff" />
          <ThemedText style={styles.headerTitle}>Historial</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {history.length > 0
              ? `${history.length} ${history.length === 1 ? 'descarga' : 'descargas'}`
              : 'Sin descargas aun'}
          </ThemedText>
        </View>
      </View>

      {history.length > 0 ? (
        <>
          <View style={styles.toolbar}>
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.clearAllButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <ThemedText style={styles.clearAllText}>Borrar todo</ThemedText>
            </TouchableOpacity>
          </View>

          <FlatList
            key={refreshKey}
            data={history}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <HistoryItem
                item={item}
                isDark={isDark}
                onCopyUrl={handleCopyUrl}
                onDelete={handleDelete}
              />
            )}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="download-outline"
            size={64}
            color={isDark ? '#4B5563' : '#D1D5DB'}
          />
          <ThemedText style={styles.emptyTitle}>Sin descargas</ThemedText>
          <ThemedText style={styles.emptyText}>
            Cuando descargues un Reel, aparecera aqui.
          </ThemedText>
        </View>
      )}
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
  },

  /* Toolbar */
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearAllText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },

  /* List */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },

  /* History card */
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
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
  historyCardDark: {
    backgroundColor: '#1E1E2E',
  },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbContainer: {
    width: 90,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbDuration: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbDurationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  historyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  historyUploader: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  /* Actions */
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  actionChipDark: {
    backgroundColor: '#2D2044',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
  actionChipTextDark: {
    color: '#C084FC',
  },
  deleteChip: {
    padding: 6,
    borderRadius: 8,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 20,
  },
});
