import axios from 'axios';
import { getToken, clearToken } from './auth-utils';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthRoute = err.config?.url?.startsWith('/api/auth/');
    if (err.response?.status === 401 && !isAuthRoute && typeof window !== 'undefined') {
      clearToken();
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);

export default api;
