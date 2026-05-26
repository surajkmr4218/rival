import axios from 'axios';
import { BACKEND_URL, API_TIMEOUT } from './config';
import { getToken, saveToken, deleteToken } from './storage';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: API_TIMEOUT,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export { saveToken, deleteToken, getToken };

// Auth
export const register = (email: string, username: string, password: string) =>
  api.post('/api/auth/register', { email, username, password });

export const login = (email: string, password: string) =>
  api.post('/api/auth/login', `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

// User
export const getMe = () => api.get('/api/users/me');
export const searchUsers = (query: string) => api.post('/api/users/search', { query });
export const getUserStats = () => api.get('/api/users/me/stats');
export const addBalance = (amountCents: number) => api.post('/api/users/me/balance', { amount_cents: amountCents });
export const getBalanceHistory = (period: string = '1W') =>
  api.get('/api/users/me/balance-history', { params: { period } });

// Challenges
import type { ChallengeCreate } from './types';

export const createChallenge = (data: ChallengeCreate) =>
  api.post('/api/challenges', data);

export const getChallenges = () => api.get('/api/challenges');
export const getChallenge = (id: number) => api.get(`/api/challenges/${id}`);
export const getPendingChallenges = () => api.get('/api/challenges/pending');
export const getActiveChallenges = () => api.get('/api/challenges/active');
export const acceptChallenge = (id: number, data?: { opponent_notion_page_id?: string }) =>
  api.post(`/api/challenges/${id}/accept`, data || {});
export const declineChallenge = (id: number) => api.post(`/api/challenges/${id}/decline`);
export const cancelChallenge = (id: number) => api.post(`/api/challenges/${id}/cancel`);
export const refreshChallengeProgress = (id: number) => api.post(`/api/challenges/${id}/refresh`);
// Kicks off AI evaluation. Returns 202 immediately with status='evaluating'.
// Poll getChallenge() until status flips to 'completed'.
export const evaluateChallenge = (id: number) =>
  api.post(`/api/challenges/${id}/evaluate`);

// GitHub
export const getGitHubStatus = () => api.get('/api/github/status');
// GitHub's callback URL is configured server-side (GITHUB_REDIRECT_URI) and
// must match what's registered in the GitHub OAuth App — the client can't
// override it. The backend's /api/github/callback then deep-links into the
// app, bouncing to whatever `returnUrl` we pass here (validated against an
// allowlist of app schemes). This is what lets the same flow work in Expo Go
// (exp://...) and in a real build (rival://...).
export const getGitHubOAuthUrl = (returnUrl?: string) =>
  api.get('/api/github/oauth-url', { params: returnUrl ? { return_url: returnUrl } : {} });
export const connectGitHub = (code: string) => api.post('/api/github/connect', { code });
export const disconnectGitHub = () => api.delete('/api/github/disconnect');
export const getGitHubCommits = (hours?: number) =>
  api.get('/api/github/commits', { params: hours ? { hours } : {} });

// Notion
export const getNotionStatus = () => api.get('/api/notion/status');
export const getNotionOAuthUrl = (redirectUri?: string) =>
  api.get('/api/notion/oauth-url', { params: redirectUri ? { redirect_uri: redirectUri } : {} });
export const connectNotion = (code: string) => api.post('/api/notion/connect', { code });
export const disconnectNotion = () => api.delete('/api/notion/disconnect');
export const searchNotionPages = (query?: string) =>
  api.get('/api/notion/pages', { params: query ? { query } : {} });

// Challenge Notion
export const setChallengeNotionPage = (challengeId: number, pageId: string) =>
  api.post(`/api/challenges/${challengeId}/set-notion-page`, null, { params: { page_id: pageId } });
export const pollChallengeNotion = (challengeId: number) =>
  api.post(`/api/challenges/${challengeId}/poll-notion`);

export default api;
