import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'download_history';
const MAX_HISTORY = 200;

export type DownloadRecord = {
  id: string;
  url: string;
  title: string;
  uploader: string;
  thumbnail: string;
  duration: number;
  downloadedAt: number;
};

type HistoryContextType = {
  history: DownloadRecord[];
  isLoading: boolean;
  addRecord: (record: Omit<DownloadRecord, 'id' | 'downloadedAt'>) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

const HistoryContext = createContext<HistoryContextType>({
  history: [],
  isLoading: true,
  addRecord: async () => {},
  removeRecord: async () => {},
  clearHistory: async () => {},
});

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setHistory(JSON.parse(saved));
        }
      } catch {
        // corrupt data, ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (records: DownloadRecord[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, []);

  const addRecord = useCallback(
    async (record: Omit<DownloadRecord, 'id' | 'downloadedAt'>) => {
      const newRecord: DownloadRecord = {
        ...record,
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        downloadedAt: Date.now(),
      };
      const updated = [newRecord, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      await persist(updated);
    },
    [history, persist],
  );

  const removeRecord = useCallback(
    async (id: string) => {
      const updated = history.filter((r) => r.id !== id);
      setHistory(updated);
      await persist(updated);
    },
    [history, persist],
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <HistoryContext.Provider
      value={{ history, isLoading, addRecord, removeRecord, clearHistory }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export const useHistory = () => useContext(HistoryContext);
