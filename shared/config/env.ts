const normalizeBaseUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
};

const defaultApiBaseUrl = 'http://43.163.75.18:8090';

export const API_BASE_URL =
  normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) || defaultApiBaseUrl;

export const WS_BASE_URL =
  normalizeBaseUrl(process.env.EXPO_PUBLIC_WS_BASE_URL) ||
  API_BASE_URL.replace(/^http/, 'ws');
