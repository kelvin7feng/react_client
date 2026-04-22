import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';
import { EventBus, Events } from '@/config/events';

type ToastKind = 'success' | 'error';

export type PublishSubmitPayload = {
  formData: FormData;
  // 发布成功后的回调（在 Provider 内部触发 invalidate 等副作用后再调用）
  onSuccess?: (articleId?: number) => void;
  // 发布失败回调，用于业务侧做额外提示/重试（默认已有 Toast）
  onError?: (message: string) => void;
};

type Ctx = {
  publishing: boolean;
  progress: number;
  // 动画版本的进度值，供 PublishProgressBar 内部做 width 插值使用
  progressAnim: Animated.Value;
  submit: (payload: PublishSubmitPayload) => Promise<void>;
};

const PublishTaskContext = createContext<Ctx | null>(null);

export function usePublishTask() {
  const ctx = useContext(PublishTaskContext);
  if (!ctx) {
    throw new Error('usePublishTask must be used inside <PublishTaskProvider>');
  }
  return ctx;
}

/**
 * 发布任务后台管理：
 *  - 接管发布接口的 XHR 上传（携带进度）
 *  - 提供 TabBar 上方的迷你水平进度条
 *  - 发布完成/失败时在顶部显示飘字 Toast
 *  - 负责 invalidate 相关查询，让首页/个人页自动刷新
 *
 * Provider 应挂载在 Tabs 容器内（这样进度条可以基于同一个 Safe Area 贴在 TabBar 上方），
 * 并位于 <QueryClientProvider> 内部以便调用 queryClient。
 */
export function PublishTaskProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [publishing, setPublishing] = useState(false);
  // progress: 0~1。在 onload 成功时推进到 1，随后在 400ms 后回到 0 用于渐隐。
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(
    null,
  );

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const showToast = useCallback(
    (text: string, kind: ToastKind) => {
      setToast({ text, kind });
      toastAnim.stopAnimation();
      toastAnim.setValue(0);
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2400);
    },
    [toastAnim],
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (xhrRef.current) {
        try {
          xhrRef.current.abort();
        } catch {}
      }
    },
    [],
  );

  const submit = useCallback(
    async ({ formData, onSuccess, onError }: PublishSubmitPayload) => {
      if (publishing) {
        showToast('还有发布任务进行中，请稍候', 'error');
        return;
      }
      setPublishing(true);
      setProgress(0);

      const token = await AsyncStorage.getItem('user_token');
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('POST', `${API_BASE_URL}${API_ENDPOINTS.PUBLISH_ARTICLE}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      // 注意：FormData 的 Content-Type (multipart/form-data; boundary=...) 由 RN 底层自动设置，
      // 这里手动设会破坏 boundary，切勿显式赋值。

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // 上传阶段最多到 0.99，留给服务端处理那一段空间，避免先到 100% 再停留过久。
          setProgress(Math.min(0.99, e.loaded / e.total));
        }
      };

      const finalize = (kind: ToastKind, message: string, articleId?: number) => {
        xhrRef.current = null;
        if (kind === 'success') {
          setProgress(1);
          queryClient.invalidateQueries({ queryKey: ['myHome'] });
          // feed 前缀匹配：包含 ['feed','recommend',page] / ['feed','following',page] / ['feed','nearby',...]
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          // 首页推荐/关注/附近 tab 使用本地 tabStates 管理数据，React Query 仅做缓存，
          // 单纯 invalidate 不会触发重新拉取，这里额外 emit 一个事件通知首页刷新。
          EventBus.emit(Events.ARTICLE_PUBLISHED, { articleId });
          showToast(message, 'success');
          onSuccess?.(articleId);
        } else {
          showToast(message, 'error');
          onError?.(message);
        }
        // 稍作停留让用户看到 100% / 错误态后再收起进度条
        setTimeout(() => {
          setPublishing(false);
          setProgress(0);
        }, kind === 'success' ? 400 : 200);
      };

      xhr.onerror = () => finalize('error', '发布失败，请检查网络');
      xhr.ontimeout = () => finalize('error', '发布超时，请重试');
      xhr.onload = () => {
        try {
          const rawText = xhr.responseText || '';
          const payload = rawText ? JSON.parse(rawText) : null;
          const code = payload?.code;
          if (xhr.status >= 200 && xhr.status < 300 && code === 0) {
            finalize('success', '发布成功', payload?.data?.article_id);
          } else {
            finalize(
              'error',
              payload?.msg || payload?.error || `发布失败 (HTTP ${xhr.status})`,
            );
          }
        } catch {
          finalize('error', '发布失败，响应解析异常');
        }
      };

      xhr.send(formData);
    },
    [publishing, queryClient, showToast],
  );

  // Toast 垂直位置（顶部状态栏下方一点）
  const toastTop = insets.top + 56;

  return (
    <PublishTaskContext.Provider
      value={{ publishing, progress, progressAnim, submit }}
    >
      {children}

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            {
              top: toastTop,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              toast.kind === 'error' && styles.toastError,
            ]}
          >
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </PublishTaskContext.Provider>
  );
}

/**
 * 紧贴在底部 Tab 导航栏上方的水平迷你进度条。
 * 必须渲染在 <PublishTaskProvider> 内部。
 *
 * 推荐用法：在 Tabs 的 `tabBar` 自定义函数里把它放到 <BottomTabBar /> 上方，
 * 这样进度条会始终与 TabBar 的顶边完美贴合（不依赖 safe area / tabBarStyle.height 计算）。
 */
export function PublishProgressBar() {
  const ctx = useContext(PublishTaskContext);
  if (!ctx) return null;
  const { publishing, progress, progressAnim } = ctx;
  // 未发布且进度为 0 时不占据任何空间，避免在 TabBar 上方留出 2px 视觉缝隙
  if (!publishing && progress <= 0) return null;
  return (
    <View pointerEvents="none" style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 2,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  progressFill: {
    height: 2,
    backgroundColor: '#ff2442',
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 201,
    elevation: 201,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(40, 167, 69, 0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  toastError: {
    backgroundColor: 'rgba(220, 53, 69, 0.92)',
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
