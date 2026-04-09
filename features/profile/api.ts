import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson, requestJson } from '@/shared/http/client';

export type BasicUserProfile = {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
  signature?: string;
  birthday?: string;
  gender?: number;
};

type UpdateProfileInput = {
  username: string;
  signature: string;
  gender: number;
  birthday: string;
  avatarFile?: {
    uri: string;
    name?: string;
    type?: string;
  } | null;
};

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchBasicInfo(id?: number) {
  return unwrapData<BasicUserProfile>(
    getJson(API_ENDPOINTS.GET_BASIC_INFO, id ? { id } : undefined)
  );
}

export function updateProfile(input: UpdateProfileInput) {
  const formData = new FormData();
  formData.append('username', input.username.trim());
  formData.append('signature', input.signature.trim());
  formData.append('gender', String(input.gender));
  formData.append('birthday', input.birthday);

  if (input.avatarFile) {
    formData.append('avatar', {
      uri: input.avatarFile.uri,
      name: input.avatarFile.name || 'avatar.jpg',
      type: input.avatarFile.type || 'image/jpeg',
    } as any);
  }

  return unwrapData<{ avatar?: string }>(
    requestJson(API_ENDPOINTS.UPDATE_USER_INFO, {
      method: 'PUT',
      body: formData,
    })
  );
}
