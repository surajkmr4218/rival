import { Platform } from 'react-native';
import { create } from 'zustand';
import { getToken } from './storage';
import { BACKEND_URL } from './config';
import type { Challenge } from './types';

interface RealtimeState {
  connected: boolean;
  // The most recently pushed challenge. Screens watch this and merge it
  // into their own local state.
  lastChallenge: Challenge | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// Module-level (not in the store) so React re-renders never recreate them.
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = false;
let backoffMs = 1000; // grows on repeated failures, capped below

export const useRealtime = create<RealtimeState>((set) => ({
  connected: false,
  lastChallenge: null,

  connect: async () => {
    const token = await getToken();
    if (!token) return; // not logged in yet
    if (socket) return; // already connected/connecting

    shouldReconnect = true;

    // http://host:8000  ->  ws://host:8000
    const wsBase = BACKEND_URL.replace(/^http/, 'ws');

    // Native: token in the Authorization header (URL stays clean, never logged).
    // Web (dev): browser can't set headers, so use ?token= instead.
    let ws: WebSocket;
    if (Platform.OS === 'web') {
      ws = new WebSocket(`${wsBase}/api/ws?token=${encodeURIComponent(token)}`);
    } else {
      // React Native's WebSocket takes (url, protocols, options). The third
      // `options.headers` arg is RN-specific and absent from the DOM lib type,
      // so we cast the constructor to `any` (the DOM type allows only 2 args).
      // Ignored on web, which is why we branch.
      const RNWebSocket = WebSocket as any;
      ws = new RNWebSocket(`${wsBase}/api/ws`, undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    socket = ws;

    ws.onopen = () => {
      backoffMs = 1000; // reset backoff on a healthy connection
      set({ connected: true });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'challenge_updated') {
          set({ lastChallenge: msg.challenge as Challenge });
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      socket = null;
      set({ connected: false });
      // Auto-reconnect (unless we logged out) with simple backoff.
      if (shouldReconnect) {
        backoffMs = Math.min(backoffMs * 2, 15000);
        reconnectTimer = setTimeout(() => useRealtime.getState().connect(), backoffMs);
      }
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose -> reconnect
    };
  },

  disconnect: () => {
    shouldReconnect = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
    set({ connected: false, lastChallenge: null });
  },
}));
