import { create } from 'zustand';
import * as api from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.login(email, password);
      await api.saveToken(data.access_token);
      await get().loadUser();
    } catch (e: any) {
      console.log('Login error:', e.message, e.response?.data);
      const errorMsg = e.response?.data?.detail || e.message || 'Login failed';
      set({ error: errorMsg, isLoading: false });
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      await api.register(email, username, password);
      await get().login(email, password);
    } catch (e: any) {
      console.log('Registration error:', e.message, e.response?.data);
      const errorMsg = e.response?.data?.detail || e.message || 'Registration failed';
      set({ error: errorMsg, isLoading: false });
    }
  },

  logout: async () => {
    await api.deleteToken();
    set({ user: null, error: null });
  },

  loadUser: async () => {
    try {
      const token = await api.getToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await api.getMe();
      set({ user: data, isLoading: false });
    } catch {
      await api.deleteToken();
      set({ user: null, isLoading: false });
    }
  },
}));
