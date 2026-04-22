/**
 * API 配置
 * 统一管理所有 API 基础 URL 和端点
 */

import { API_BASE_URL } from '../shared/config/env';

// API 基础 URL
export { API_BASE_URL };

// API 端点
export const API_ENDPOINTS = {
  // 用户相关
  GET_BASIC_INFO: '/getbasicinfo',
  USER_STATS: '/userstats',
  UPDATE_USER_INFO: '/updateuserinfo',

  // 首页 Tab
  RECOMMENDATIONS: '/recommendations',
  FOLLOWING_ARTICLES: '/following-articles',
  NEARBY_ARTICLES: '/nearby-articles',

  // 品牌相关
  GET_BRANDS: '/getbrands',
  GET_VEHICLES: '/getvehicles',
  GET_VEHICLES_BY_PRICE: '/getvehiclesbyprice',

  // 车辆相关
  GET_VEHICLE_DETAIL: '/getvehicledetail',

  // 文章相关
  PUBLISH_ARTICLE: '/publish',
  GET_ARTICLE_DETAIL: '/getarticledetail',
  GET_COMMENTS: '/getcomments',
  GET_CHILD_COMMENTS: '/getchildcomments',
  CREATE_COMMENT: '/createcomment',
  TOGGLE_LIKE: '/togglelike',
  TOGGLE_FAVORITE: '/togglefavorite',
  TOGGLE_COMMENT_LIKE: '/togglecommentlike',
  DELETE_ARTICLE: '/deletearticle',
  UPDATE_ARTICLE_VISIBILITY: '/updatearticlevisibility',

  // 关注
  TOGGLE_FOLLOW: '/togglefollow',
  FOLLOWERS: '/followers',
  FOLLOWING: '/following',
  MUTUAL_FOLLOWS: '/mutualfollows',
  FOLLOW_STATUS: '/followstatus',

  // 我的 Tab
  MY_FAVORITES: '/myfavorites',
  MY_LIKED: '/myliked',
  MY_VIEWED: '/myviewed',
  MY_COMMENTS: '/mycomments',

  // 搜索
  SEARCH: '/search',

  // 登录注册
  SEND_CODE: '/send-code',
  REGISTER: '/register',
  LOGIN: '/login',

  // 消息
  MESSAGES: '/messages',
  READ_MESSAGE: '/readmessage',
  READ_ALL_MESSAGES: '/readallmessages',
  UNREAD_COUNT: '/unreadcount',

  // 私信
  CONVERSATIONS: '/conversations',
  CHAT_HISTORY: '/chathistory',
  SEND_MESSAGE: '/sendmessage',
  TOGGLE_CONVERSATION_PIN: '/toggleconversationpin',
  DELETE_CONVERSATION: '/deleteconversation',

  // 工具
  DECODE_QRCODE: '/decode-qrcode',

  // BFF
  BFF_MOBILE_ME_HOME: '/bff/mobile/me/home',
  BFF_MOBILE_USERS: '/bff/mobile/users',
  BFF_MOBILE_ARTICLES: '/bff/mobile/articles',
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

