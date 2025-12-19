/**
 * API 配置
 * 统一管理所有 API 基础 URL 和端点
 */

// API 基础 URL
export const API_BASE_URL = 'http://119.28.108.105:8090';

// API 端点
export const API_ENDPOINTS = {
  // 用户相关
  GET_BASIC_INFO: '/getbasicinfo',
  
  // 推荐相关
  RECOMMENDATIONS: '/recommendations',
  
  // 品牌相关
  GET_BRANDS: '/getbrands',
  GET_VEHICLES: '/getvehicles',
  
  // 车辆相关
  GET_VEHICLE_DETAIL: '/getvehicledetail',
} as const;

/**
 * 构建完整的 API URL
 * @param endpoint - API 端点
 * @param params - 查询参数对象（可选）
 * @returns 完整的 API URL
 */
export const buildApiUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  if (params && Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    return `${url}?${queryString}`;
  }
  
  return url;
};

