/** @format */

import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "ig_session";

export type InstagramCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expires?: string;
};

type SessionState = {
  cookies: InstagramCookie[];
  username: string | null;
};

type SessionContextType = {
  isLoggedIn: boolean;
  username: string | null;
  cookies: InstagramCookie[];
  isLoading: boolean;
  saveCookies: (
    cookies: InstagramCookie[],
    username?: string | null,
  ) => Promise<void>;
  clearSession: () => Promise<void>;
  cookiesForApi: () => string | undefined;
};

const SessionContext = createContext<SessionContextType>({
  isLoggedIn: false,
  username: null,
  cookies: [],
  isLoading: true,
  saveCookies: async () => {},
  clearSession: async () => {},
  cookiesForApi: () => undefined,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    cookies: [],
    username: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved) {
          setSession(JSON.parse(saved));
        }
      } catch {
        // corrupt data, ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveCookies = useCallback(
    async (cookies: InstagramCookie[], username?: string | null) => {
      const dsUser = cookies.find((c) => c.name === "ds_user_id");
      const newSession: SessionState = {
        cookies,
        username: username ?? dsUser?.value ?? null,
      };
      setSession(newSession);
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newSession));
    },
    [],
  );

  const clearSession = useCallback(async () => {
    setSession({ cookies: [], username: null });
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }, []);

  const cookiesForApi = useCallback((): string | undefined => {
    if (session.cookies.length === 0) return undefined;

    const lines = session.cookies.map((c) => {
      const domain = c.domain || ".instagram.com";
      const subdomains = domain.startsWith(".") ? "TRUE" : "FALSE";
      const path = c.path || "/";
      const secure = c.secure ? "TRUE" : "FALSE";
      const expiry = "0";
      return `${domain}\t${subdomains}\t${path}\t${secure}\t${expiry}\t${c.name}\t${c.value}`;
    });

    return lines.join("\n");
  }, [session.cookies]);

  const isLoggedIn = session.cookies.some(
    (c) => c.name === "sessionid" && c.value,
  );

  return (
    <SessionContext.Provider
      value={{
        isLoggedIn,
        username: session.username,
        cookies: session.cookies,
        isLoading,
        saveCookies,
        clearSession,
        cookiesForApi,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
