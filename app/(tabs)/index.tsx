import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useQueryClient } from '@tanstack/react-query';
import { fetchFollowingArticles, fetchNearbyArticles, fetchRecommendations, toggleArticleLike } from '@/features/community/api';
import { queryKeys } from '@/shared/query/keys';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { navigateToUserProfile, navigateToArticle } from '../../config/utils';
import { WaterfallArticleCard, WaterfallTwoColumnGrid } from '../../components/WaterfallArticleCard';
import { SwipeTabView } from '../../components/SwipeTabView';
import { SettingsDrawer } from '../../components/SettingsDrawer';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';
import { LoadingStateView } from '@/components/LoadingStateView';

const SCREEN_WIDTH = Dimensions.get('window').width;
const REFRESH_TRIGGER_DISTANCE = 72;
const SKEL_BONE = '#e8e8e8';

const SHIMMER_W = SCREEN_WIDTH * 2;

const HomeScreenSkeleton = () => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_W, SCREEN_WIDTH],
  });

  const Bone = ({ w, h, r = 6, style }: { w: number | string; h?: number; r?: number; style?: any }) => (
    <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: SKEL_BONE, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[SKEL_BONE, '#f5f5f5', SKEL_BONE]}
          locations={[0.08, 0.18, 0.33]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: SHIMMER_W }}
        />
      </Animated.View>
    </View>
  );

  const cardSkeleton = (titleW = '85%') => (
    <View style={skelStyles.card}>
      <Bone w="100%" r={0} style={{ aspectRatio: 3 / 4 }} />
      <View style={skelStyles.cardBody}>
        <Bone w={titleW} h={12} r={4} />
        <View style={skelStyles.cardFooter}>
          <Bone w={50} h={10} r={4} />
          <Bone w={30} h={10} r={4} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={skelStyles.root}>
      <View style={skelStyles.header}>
        <Bone w={24} h={24} r={4} />
        <View style={skelStyles.headerTabs}>
          <Bone w={36} h={20} r={10} />
          <Bone w={36} h={20} r={10} />
          <Bone w={36} h={20} r={10} />
        </View>
        <Bone w={24} h={24} r={4} />
      </View>
      <View style={skelStyles.grid}>
        <View style={skelStyles.gridCol}>
          {cardSkeleton('70%')}
          {cardSkeleton('55%')}
        </View>
        <View style={skelStyles.gridCol}>
          {cardSkeleton('60%')}
          {cardSkeleton('80%')}
        </View>
      </View>
    </View>
  );
};

const skelStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    paddingHorizontal: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTabs: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xs,
    marginTop: 5,
  },
  gridCol: {
    flex: 1,
    marginHorizontal: 3,
  },
  card: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Spacing.sm - 2,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  cardBody: {
    padding: Spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm - 2,
  },
});

type TabKey = 'following' | 'recommend' | 'nearby';

const TAB_ORDER: TabKey[] = ['following', 'recommend', 'nearby'];

const TabContent = ({
  state,
  onScroll,
  onRefresh,
  onRetry,
  emptyMessage,
  renderItem,
}: {
  state: TabState;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onRefresh: () => void;
  onRetry: () => void;
  emptyMessage: string;
  renderItem: (item: any) => React.ReactNode;
}) => {
  const scrollY = useSharedValue(0);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
      onScroll(e);
    },
    [onScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (state.refreshing) {
        return;
      }

      if (e.nativeEvent.contentOffset.y <= -REFRESH_TRIGGER_DISTANCE) {
        onRefresh();
      }
    },
    [state.refreshing, onRefresh],
  );

  if (state.loading && !state.refreshing) {
    return <LoadingView />;
  }

  if (state.error && state.items.length === 0) {
    return <ErrorView error={state.error} onRetry={onRetry} />;
  }

  if (state.items.length === 0 && state.initialized) {
    return <EmptyView message={emptyMessage} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <BouncingDotsIndicator scrollY={scrollY} refreshing={state.refreshing} />
      <ScrollView
        style={CommonStyles.scrollView}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {renderItem(state.items)}

        {state.loadingMore && (
          <View style={CommonStyles.loadingMoreContainer}>
            <BouncingDotsIndicator mode="inline" size={18} color="#999" />
            <Text style={CommonStyles.loadingMoreText}>加载更多...</Text>
          </View>
        )}

        {!state.hasMore && state.items.length > 0 && (
          <View style={CommonStyles.noMoreContainer}>
            <Text style={CommonStyles.noMoreText}>没有更多数据了</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const LoadingView = () => (
  <LoadingStateView
    text="数据加载中..."
    size={24}
    color={Colors.textTertiary}
    style={CommonStyles.loadingContainer}
    textStyle={CommonStyles.loadingText}
  />
);

const isNetworkErrorMsg = (msg: string) => /network.?request.?failed/i.test(msg);

const ErrorView = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <View style={CommonStyles.errorContainer}>
    <Ionicons name="alert-circle" size={50} color={Colors.error} />
    <Text style={CommonStyles.errorText}>加载失败</Text>
    {!isNetworkErrorMsg(error) && (
      <Text style={CommonStyles.errorSubText}>{error}</Text>
    )}
    <TouchableOpacity style={CommonStyles.retryButton} onPress={onRetry}>
      <Text style={CommonStyles.retryButtonText}>点击重试</Text>
    </TouchableOpacity>
  </View>
);

const EmptyView = ({ message }: { message: string }) => (
  <View style={styles.emptyContainer}>
    <Ionicons name="document-text-outline" size={60} color={Colors.textDisabled} />
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

type TabState = {
  items: any[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  initialized: boolean;
};

const initialTabState: TabState = {
  items: [],
  loading: true,
  loadingMore: false,
  refreshing: false,
  error: null,
  page: 1,
  hasMore: true,
  initialized: false,
};

export default function Index() {
  const router = useRouter();
  const { userId, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('recommend');
  const [city, setCity] = useState<string>('');
  const [cityDisplay, setCityDisplay] = useState<string>('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const skeletonFade = useRef(new Animated.Value(1)).current;
  const [skeletonDismissed, setSkeletonDismissed] = useState(false);

  const [tabStates, setTabStates] = useState<Record<TabKey, TabState>>({
    following: { ...initialTabState },
    recommend: { ...initialTabState },
    nearby: { ...initialTabState },
  });

  const isLoadingRef = useRef<Record<TabKey, boolean>>({
    following: false,
    recommend: false,
    nearby: false,
  });
  const lastLoadedPageRef = useRef<Record<TabKey, number>>({
    following: 0,
    recommend: 0,
    nearby: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo?.city) {
          setCity(geo.city);
          setCityDisplay(geo.city.replace(/市$/, ''));
        }
      } catch {}
    })();
  }, []);

  const updateTabState = useCallback((tab: TabKey, partial: Partial<TabState>) => {
    setTabStates(prev => ({
      ...prev,
      [tab]: { ...prev[tab], ...partial },
    }));
  }, []);

  const getCacheKey = useCallback((tab: TabKey, pageNum: number) => {
    if (tab === 'following') return queryKeys.followingArticles(pageNum);
    if (tab === 'nearby') return queryKeys.nearbyArticles(pageNum, city);
    return queryKeys.recommendations(pageNum);
  }, [city]);

  const fetchArticles = useCallback(async (tab: TabKey, pageNum = 1, append = false) => {
    if (isLoadingRef.current[tab] || (append && lastLoadedPageRef.current[tab] >= pageNum)) {
      return;
    }

    isLoadingRef.current[tab] = true;
    lastLoadedPageRef.current[tab] = pageNum;

    const cachedData = pageNum === 1
      ? queryClient.getQueryData<any[]>(getCacheKey(tab, 1))
      : undefined;

    if (cachedData && !append) {
      const cacheState = queryClient.getQueryState(getCacheKey(tab, 1));
      const isStale = !cacheState || cacheState.dataUpdatedAt < Date.now() - 2 * 60 * 1000;

      setTabStates(prev => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          items: cachedData,
          hasMore: cachedData.length >= 10,
          page: 1,
          loading: false,
          loadingMore: false,
          refreshing: false,
          error: null,
          initialized: true,
        },
      }));
      isLoadingRef.current[tab] = false;

      if (!isStale) return;
    }

    updateTabState(tab, {
      error: null,
      ...(append
        ? { loadingMore: true }
        : cachedData ? {} : { loading: !tabStates[tab]?.refreshing }),
    });

    try {
      let data: any[] = [];
      if (tab === 'following') {
        data = await fetchFollowingArticles(pageNum);
      } else if (tab === 'nearby') {
        data = await fetchNearbyArticles(pageNum, city);
      } else {
        data = await fetchRecommendations(pageNum);
      }

      if (pageNum === 1) {
        queryClient.setQueryData(getCacheKey(tab, 1), data);
      }

      setTabStates(prev => {
        const current = prev[tab];
        return {
          ...prev,
          [tab]: {
            ...current,
            items: append ? [...current.items, ...data] : data,
            hasMore: data.length >= 10,
            page: pageNum,
            loading: false,
            loadingMore: false,
            refreshing: false,
            error: null,
            initialized: true,
          },
        };
      });
    } catch (err: any) {
      lastLoadedPageRef.current[tab] = pageNum - 1;
      updateTabState(tab, {
        error: err.message,
        loading: false,
        loadingMore: false,
        refreshing: false,
      });
    } finally {
      isLoadingRef.current[tab] = false;
    }
  }, [userId, city, updateTabState, queryClient, getCacheKey]);

  useEffect(() => {
    lastLoadedPageRef.current.recommend = 0;
    updateTabState('recommend', { ...initialTabState });
    fetchArticles('recommend', 1, false);
  }, [userId]);

  const activeTabInitialized = tabStates[activeTab].initialized;
  useEffect(() => {
    if (activeTabInitialized || isLoadingRef.current[activeTab]) return;
    if (activeTab === 'nearby' && !city) return;
    lastLoadedPageRef.current[activeTab] = 0;
    fetchArticles(activeTab, 1, false);
  }, [activeTabInitialized, activeTab, city, fetchArticles]);

  useEffect(() => {
    if (city && tabStates.nearby.initialized) {
      lastLoadedPageRef.current.nearby = 0;
      updateTabState('nearby', { ...initialTabState });
      fetchArticles('nearby', 1, false);
    }
  }, [city]);

  // 文章发布成功事件：把所有 tab 标记为未初始化并清空本地列表/缓存游标；
  // 当前激活的 tab 立即从第 1 页重新拉取，其他 tab 会在切换时按"未初始化"分支自动拉取。
  useEffect(() => {
    const off = EventBus.on(Events.ARTICLE_PUBLISHED, () => {
      TAB_ORDER.forEach((k) => {
        lastLoadedPageRef.current[k] = 0;
        isLoadingRef.current[k] = false;
        // 让下次该 tab 展示时命中 "!initialized" 重新拉取。
        queryClient.removeQueries({ queryKey: getCacheKey(k, 1) });
      });
      setTabStates({
        following: { ...initialTabState },
        recommend: { ...initialTabState },
        nearby: { ...initialTabState },
      });
      // 立即对当前激活 tab 触发一次刷新（nearby 需要 city，没定位到时跳过）
      if (activeTab === 'nearby' && !city) return;
      fetchArticles(activeTab, 1, false);
    });
    return off;
  }, [activeTab, city, fetchArticles, queryClient, getCacheKey]);

  useEffect(() => {
    const off = EventBus.on(Events.ARTICLE_LIKE_CHANGED, ({ articleId, liked, likeCount }: LikeChangedPayload) => {
      setTabStates(prev => {
        const next = { ...prev };
        for (const key of TAB_ORDER) {
          next[key] = {
            ...prev[key],
            items: prev[key].items.map(item =>
              item.id === articleId ? { ...item, likes: likeCount, liked } : item
            ),
          };
        }
        return next;
      });
    });
    return off;
  }, []);

  useEffect(() => {
    const off = EventBus.on(Events.ARTICLE_DELETED, ({ articleId }: { articleId: number }) => {
      setTabStates(prev => {
        const next = { ...prev };
        for (const key of TAB_ORDER) {
          next[key] = {
            ...prev[key],
            items: prev[key].items.filter(item => item.id !== articleId),
          };
        }
        return next;
      });
    });
    return off;
  }, []);

  useEffect(() => {
    if (tabStates.recommend.initialized && !skeletonDismissed) {
      Animated.timing(skeletonFade, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSkeletonDismissed(true));
    }
  }, [tabStates.recommend.initialized, skeletonDismissed]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey);
  }, []);

  const handleCardLike = useCallback(async (article: any) => {
    if (!isLoggedIn) { router.push('/login'); return; }
    const newLiked = !article.liked;
    const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);

    setTabStates(prev => {
      const next = { ...prev };
      for (const key of TAB_ORDER) {
        next[key] = {
          ...prev[key],
          items: prev[key].items.map(it =>
            it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it
          ),
        };
      }
      return next;
    });

    try {
      await toggleArticleLike(article.id);
      EventBus.emit(Events.ARTICLE_LIKE_CHANGED, {
        articleId: article.id,
        liked: newLiked,
        likeCount: newCount,
      } as LikeChangedPayload);
    } catch {
      setTabStates(prev => {
        const next = { ...prev };
        for (const key of TAB_ORDER) {
          next[key] = {
            ...prev[key],
            items: prev[key].items.map(it =>
              it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it
            ),
          };
        }
        return next;
      });
    }
  }, [isLoggedIn, userId, router]);

  const makeVerticalScrollHandler = useCallback((tab: TabKey) => {
    return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 600;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
        const state = tabStates[tab];
        if (!isLoadingRef.current[tab] && state?.hasMore) {
          fetchArticles(tab, state.page + 1, true);
        }
      }
    };
  }, [tabStates, fetchArticles]);

  const navigateSearch = useCallback(() => {
    if (!isLoggedIn) { router.push('/login'); return; }
    router.push('/search');
  }, [isLoggedIn, router]);

  const getEmptyMessage = (tab: TabKey) => {
    if (tab === 'following') return '还没有关注任何人，去关注感兴趣的人吧';
    if (tab === 'nearby') return cityDisplay ? '当前城市暂无内容' : '正在获取位置信息...';
    return '暂无推荐内容';
  };

  const handleAuthorPress = useCallback((authorId: number) => {
    navigateToUserProfile(router, authorId, userId ?? null);
  }, [router, userId]);

  const renderWaterfall = useCallback((items: any[]) => (
    <WaterfallTwoColumnGrid
      items={items}
      keyExtractor={(item: { id: number }) => String(item.id)}
      renderItem={(item: any) => (
        <WaterfallArticleCard
          item={item}
          onPress={() => navigateToArticle(router, queryClient, item, userId)}
          onLike={handleCardLike}
          onAuthorPress={handleAuthorPress}
        />
      )}
    />
  ), [router, queryClient, userId, handleCardLike, handleAuthorPress]);

  const tabs = TAB_ORDER.map(key => ({
    key,
    label: key === 'nearby' && cityDisplay ? cityDisplay : ({ following: '关注', recommend: '推荐', nearby: '附近' })[key],
  }));

  return (
    <View style={styles.container}>
      <SettingsDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      <SwipeTabView
        tabs={tabs}
        initialIndex={1}
        tabFontSize={FontSize.md + 2}
        onTabChange={handleTabChange}
        pagerBackgroundColor={Colors.background}
        renderHeader={(tabBar) => (
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerSide} onPress={() => {
              if (!isLoggedIn) { router.push('/login'); return; }
              setDrawerVisible(true);
            }}>
              <Feather name="menu" size={24} color="black" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              {tabBar}
            </View>
            <TouchableOpacity style={styles.headerSide} onPress={navigateSearch}>
              <Ionicons name="search" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        )}
      >
        {TAB_ORDER.map((tab) => (
          <TabContent
            key={tab}
            state={tabStates[tab]}
            onScroll={makeVerticalScrollHandler(tab)}
            onRefresh={() => {
              if (!isLoggedIn) { router.push('/login'); return; }
              updateTabState(tab, { refreshing: true });
              lastLoadedPageRef.current[tab] = 0;
              fetchArticles(tab, 1, false);
            }}
            onRetry={() => {
              lastLoadedPageRef.current[tab] = 0;
              fetchArticles(tab, 1, false);
            }}
            emptyMessage={getEmptyMessage(tab)}
            renderItem={renderWaterfall}
          />
        ))}
      </SwipeTabView>

      {!skeletonDismissed && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: skeletonFade, zIndex: 30 }]}>
          <HomeScreenSkeleton />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...CommonStyles.container,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    ...CommonStyles.borderBottom,
    borderBottomColor: Colors.borderLight,
    height: 60,
    paddingHorizontal: Spacing.sm + 2,
  },
  headerSide: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
});
