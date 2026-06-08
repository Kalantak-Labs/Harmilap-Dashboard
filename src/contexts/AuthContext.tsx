"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api } from "@/lib/api";
import type { Permission } from "@/lib/types";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  permissions: Permission[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await api.auth.me();
      setUser(data as AuthUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) fetchMe();
    else setLoading(false);
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    await api.auth.login(email, password);
    await fetchMe();
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
