import { API_ENDPOINTS } from '@/config/api';
import { ApiError, requestJson } from '@/shared/http/client';

type SendCodeResult = {
  code?: string;
};

export type LoginResult = {
  user_id: number;
  username: string;
  avatar: string;
  token: string;
};

type LoginPayload = {
  mobile: string;
  password?: string;
  code?: string;
};

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function sendVerificationCode(mobile: string) {
  return unwrapData<SendCodeResult>(
    requestJson(API_ENDPOINTS.SEND_CODE, {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    })
  );
}

export function loginAccount(payload: LoginPayload) {
  return unwrapData<LoginResult>(
    requestJson(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
}
