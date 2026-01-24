import axios from 'axios';
import { BACKEND_URL, API_TIMEOUT } from '../config';
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

export default api;
