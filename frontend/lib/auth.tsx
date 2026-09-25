'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getTokens, setTokens } from '@/lib/api';
import { authApi } from '@/services/api';
import { disconnectSocket } from '@/lib/socket';
import type { User, Role } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens?.accessToken) { setLoading(false); return; }
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => setTokens(null))
      .finally(() => setLoading(false));
  }, []);

  // Forced logout when any API call hits an unrecoverable 401
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      disconnectSocket();
      router.replace('/login');
    };
    window.addEventListener('fleet:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fleet:unauthorized', onUnauthorized);
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
    setUser(res.data.user);
    router.push('/dashboard');
  }, [router]);

  const register = useCallback(async (input: { name: string; email: string; password: string; phone?: string }) => {
    const res = await authApi.register(input);
    setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
    setUser(res.data.user);
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    const tokens = getTokens();
    try { await authApi.logout(tokens?.refreshToken); } catch { /* ignore */ }
    setTokens(null);
    setUser(null);
    disconnectSocket();
    router.push('/login');
  }, [router]);

  const hasRole = useCallback(
    (...roles: Role[]) => !!user && roles.includes(user.role),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
