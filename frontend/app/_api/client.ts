import axios from 'axios';
import { BACKEND_URL, API_TIMEOUT } from '../_config';
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

// Challenges
export const createChallenge = (data: {
  category: 'coding' | 'screentime';
  stake_cents: number;
  opponent_username?: string;
  goal_type: string;
  goal_value: number;
  goal_period?: string;
}) => api.post('/api/challenges', data);

export const getChallenges = () => api.get('/api/challenges');
export const getChallenge = (id: number) => api.get(`/api/challenges/${id}`);
export const getPendingChallenges = () => api.get('/api/challenges/pending');
export const getActiveChallenges = () => api.get('/api/challenges/active');
export const acceptChallenge = (id: number) => api.post(`/api/challenges/${id}/accept`);
export const declineChallenge = (id: number) => api.post(`/api/challenges/${id}/decline`);

// GitHub
export const getGitHubStatus = () => api.get('/api/github/status');
export const getGitHubOAuthUrl = (redirectUri?: string) =>
  api.get('/api/github/oauth-url', { params: redirectUri ? { redirect_uri: redirectUri } : {} });
export const connectGitHub = (code: string) => api.post('/api/github/connect', { code });
export const disconnectGitHub = () => api.delete('/api/github/disconnect');
export const getGitHubCommits = (hours?: number) =>
  api.get('/api/github/commits', { params: hours ? { hours } : {} });

// Screen Time
export const submitScreenTime = (data: { date: string; minutes: number; category?: string }) =>
  api.post('/api/screentime/entry', data);
export const getScreenTimeEntries = (days?: number) =>
  api.get('/api/screentime/entries', { params: days ? { days } : {} });
export const getTodayScreenTime = () => api.get('/api/screentime/today');
export const getScreenTimeSummary = (days?: number) =>
  api.get('/api/screentime/summary', { params: days ? { days } : {} });

export default api;
