"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api, tokenStorage } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  register: (payload: {
    email: string;
    username: string;
    password: string;
    password_confirm: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const access = tokenStorage.getAccess();
    if (!access) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pas d'appel réseau à faire, on arrête le chargement immédiatement
      setIsLoading(false);
      return;
    }
    api
      .getProfile()
      .then(setUser)
      .catch(() => {
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login({ email, password });
    tokenStorage.set(data.access, data.refresh);
    setUser(data.user);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await api.getProfile();
    setUser(profile);
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      username: string;
      password: string;
      password_confirm: string;
    }) => {
      await api.register(payload);
      tokenStorage.clear();
      setUser(null);
    },
    []
  );

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh) await api.logout(refresh);
    } catch {
      // on déconnecte quand même côté client même si l'appel échoue
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, refreshProfile, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
