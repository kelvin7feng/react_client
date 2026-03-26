import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { WaterfallArticleCard, WaterfallTwoColumnGrid } from '../../components/WaterfallArticleCard';

const SCREEN_WIDTH = Dimensions.get('window').width;

type TabKey = 'following' | 'recommend' | 'nearby';

const TAB_LABELS: Record<TabKey, string> = {
  following: '关注',
  recommend: '推荐',
  nearby: '附近',
};

const TAB_ORDER: TabKey[] = ['following', 'recommend', 'nearby'];

const INDICATOR_WIDTH = 26;
const INDICATOR_HEIGHT = 2.5;

const COLOR_INACTIVE = Colors.textTertiary;
const COLOR_ACTIVE = Colors.textPrimary;

const Header = ({
  activeTab,
  onTabChange,
  nearbyCity,
  onSearch,
  tabCentersRef,
  indicatorStyle,
  scrollX,
  onTabsLayout,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  nearbyCity: string;
  onSearch?: () => void;
  tabCentersRef: React.MutableRefObject<number[]>;
  indicatorStyle: { left: any; width: any };
  scrollX: Animated.Value;
  onTabsLayout: () => void;
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.menuButton}>
        <Feather name="menu" size={24} color="black" />
      </TouchableOpacity>

      <View style={styles.tabBar}>
        {TAB_ORDER.map((tab, idx) => {
          const isActive = activeTab === tab;
          const label = tab === 'nearby' && nearbyCity ? nearbyCity : TAB_LABELS[tab];

          const textColor = scrollX.interpolate({
            inputRange: TAB_ORDER.map((_, i) => i * SCREEN_WIDTH),
            outputRange: TAB_ORDER.map((_, i) => i === idx ? COLOR_ACTIVE : COLOR_INACTIVE),
            extrapolate: 'clamp',
          });

          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => onTabChange(tab)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                tabCentersRef.current[idx] = x + width / 2;
                if (tabCentersRef.current.every(c => c > 0)) {
                  onTabsLayout();
                }
              }}
            >
              <Animated.Text
                style={[
                  styles.tabText,
                  
                  { color: textColor },
                ]}
              >
                {label}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}

        <Animated.View
          style={[
            styles.tabIndicator,
            {
              position: 'absolute',
              bottom: 0,
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            },
          ]}
        />
      </View>

      <TouchableOpacity style={styles.searchButton} onPress={onSearch}>
        <Ionicons name="search" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

// 单个 Tab 页的内容组件
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
  if (state.loading && !state.refreshing) {
    return (
      <View style={styles.tabPage}>
        <LoadingView />
      </View>
    );
  }

  if (state.error && state.items.length === 0) {
    return (
      <View style={styles.tabPage}>
        <ErrorView error={state.error} onRetry={onRetry} />
      </View>
    );
  }

  if (state.items.length === 0 && state.initialized) {
    return (
      <View style={styles.tabPage}>
        <EmptyView message={emptyMessage} />
      </View>
    );
  }

  return (
    <View style={styles.tabPage}>
      <ScrollView
        style={CommonStyles.scrollView}
        onScroll={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {renderItem(state.items)}

        {state.loadingMore && (
          <View style={CommonStyles.loadingMoreContainer}>
            <ActivityIndicator size="small" color={Colors.primaryBlue} />
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
  <View style={CommonStyles.loadingContainer}>
    <ActivityIndicator size="small" color="gray" />
    <Text style={CommonStyles.loadingText}>数据加载中...</Text>
  </View>
);

const ErrorView = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <View style={CommonStyles.errorContainer}>
    <Ionicons name="alert-circle" size={50} color={Colors.error} />
    <Text style={CommonStyles.errorText}>加载失败</Text>
    <Text style={CommonStyles.errorSubText}>{error}</Text>
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
  const [activeTab, setActiveTab] = useState<TabKey>('recommend');
  const [city, setCity] = useState<string>('');
  const [cityDisplay, setCityDisplay] = useState<string>('');

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

  // 获取用户城市定位
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

  const fetchArticles = useCallback(async (tab: TabKey, pageNum = 1, append = false) => {
    if (isLoadingRef.current[tab] || (append && lastLoadedPageRef.current[tab] >= pageNum)) {
      return;
    }

    isLoadingRef.current[tab] = true;
    lastLoadedPageRef.current[tab] = pageNum;

    updateTabState(tab, {
      error: null,
      ...(append ? { loadingMore: true } : { loading: !tabStates[tab]?.refreshing }),
    });

    try {
      let url: string;
      if (tab === 'following') {
        url = buildApiUrl(API_ENDPOINTS.FOLLOWING_ARTICLES, {
          page: pageNum,
          user_id: userId || 0,
        });
      } else if (tab === 'nearby') {
        url = buildApiUrl(API_ENDPOINTS.NEARBY_ARTICLES, {
          page: pageNum,
          user_id: userId || 0,
          city: city,
        });
      } else {
        url = buildApiUrl(API_ENDPOINTS.RECOMMENDATIONS, {
          page: pageNum,
          user_id: userId || 0,
        });
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }
      const data = await response.json();

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
  }, [userId, city, updateTabState]);

  // 初次加载推荐 tab
  useEffect(() => {
    lastLoadedPageRef.current.recommend = 0;
    updateTabState('recommend', { ...initialTabState });
    fetchArticles('recommend', 1, false);
  }, [userId]);

  // 切换 tab 时懒加载
  useEffect(() => {
    if (activeTab === 'recommend') return;
    if (activeTab === 'following' && !tabStates.following.initialized) {
      lastLoadedPageRef.current.following = 0;
      fetchArticles('following', 1, false);
    }
    if (activeTab === 'nearby' && city && !tabStates.nearby.initialized) {
      lastLoadedPageRef.current.nearby = 0;
      fetchArticles('nearby', 1, false);
    }
  }, [activeTab, city]);

  // 城市变化后重新加载附近 tab
  useEffect(() => {
    if (city && tabStates.nearby.initialized) {
      lastLoadedPageRef.current.nearby = 0;
      updateTabState('nearby', { ...initialTabState });
      fetchArticles('nearby', 1, false);
    }
  }, [city]);

  // 监听全局点赞事件
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

  const pagerRef = useRef<ScrollView>(null);
  const isTabSwitchingRef = useRef(false);
  const tabCentersRef = useRef<number[]>([0, 0, 0]);
  const scrollX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const buildIndicatorStyle = useCallback(() => {
    const centers = tabCentersRef.current;
    if (centers.some(c => c === 0)) return { left: 0, width: INDICATOR_WIDTH };

    const pageInputRange = TAB_ORDER.map((_, i) => i * SCREEN_WIDTH);

    const centerOutput = centers;
    const animCenter = scrollX.interpolate({
      inputRange: pageInputRange,
      outputRange: centerOutput,
      extrapolate: 'clamp',
    });

    const widthStops: number[] = [];
    const widthValues: number[] = [];
    for (let i = 0; i < TAB_ORDER.length; i++) {
      widthStops.push(i * SCREEN_WIDTH);
      widthValues.push(INDICATOR_WIDTH);
      if (i < TAB_ORDER.length - 1) {
        widthStops.push((i + 0.5) * SCREEN_WIDTH);
        widthValues.push(INDICATOR_WIDTH * 1.8);
      }
    }
    const animWidth = scrollX.interpolate({
      inputRange: widthStops,
      outputRange: widthValues,
      extrapolate: 'clamp',
    });

    const animLeft = Animated.subtract(animCenter, Animated.divide(animWidth, 2));

    return { left: animLeft, width: animWidth };
  }, [scrollX]);

  const [indicatorStyle, setIndicatorStyle] = useState<{ left: any; width: any }>({ left: 0, width: INDICATOR_WIDTH });

  const rebuildIndicator = useCallback(() => {
    setIndicatorStyle(buildIndicatorStyle());
  }, [buildIndicatorStyle]);

  const handleTabChange = useCallback((tab: TabKey) => {
    const toIdx = TAB_ORDER.indexOf(tab);
    const toX = toIdx * SCREEN_WIDTH;
    const fromX = TAB_ORDER.indexOf(activeTab) * SCREEN_WIDTH;

    isTabSwitchingRef.current = true;
    setActiveTab(tab);

    const driver = new Animated.Value(fromX);
    driver.addListener(({ value }) => {
      pagerRef.current?.scrollTo({ x: value, animated: false });
    });

    Animated.timing(driver, {
      toValue: toX,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      driver.removeAllListeners();
      isTabSwitchingRef.current = false;
    });
  }, [activeTab]);

  const onPagerScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!isTabSwitchingRef.current) {
          const pageFloat = e.nativeEvent.contentOffset.x / SCREEN_WIDTH;
          const roundedIdx = Math.max(0, Math.min(Math.round(pageFloat), TAB_ORDER.length - 1));
          const newTab = TAB_ORDER[roundedIdx];
          setActiveTab(prev => prev === newTab ? prev : newTab);
        }
      },
    }
  );

  const handleRefresh = useCallback(() => {
    if (!isLoggedIn) { router.push('/login'); return; }
    updateTabState(activeTab, { refreshing: true });
    lastLoadedPageRef.current[activeTab] = 0;
    fetchArticles(activeTab, 1, false);
  }, [activeTab, isLoggedIn, router, fetchArticles, updateTabState]);

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
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TOGGLE_LIKE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id, user_id: userId }),
      });
      const result = await response.json();
      if (result.code === 0) {
        EventBus.emit(Events.ARTICLE_LIKE_CHANGED, {
          articleId: article.id,
          liked: newLiked,
          likeCount: newCount,
        } as LikeChangedPayload);
      } else {
        // 回滚
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

  const renderWaterfall = useCallback((items: any[]) => (
    <WaterfallTwoColumnGrid
      items={items}
      keyExtractor={(item: { id: number }) => String(item.id)}
      renderItem={(item: any) => (
        <WaterfallArticleCard
          item={item}
          onPress={(id) => router.push(`/article/${id}`)}
          onLike={handleCardLike}
        />
      )}
    />
  ), [router, handleCardLike]);

  return (
    <View style={styles.container}>
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        nearbyCity={cityDisplay}
        onSearch={navigateSearch}
        tabCentersRef={tabCentersRef}
        indicatorStyle={indicatorStyle}
        scrollX={scrollX}
        onTabsLayout={rebuildIndicator}
      />

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onPagerScroll}
        contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
        style={styles.pager}
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
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.background,
    ...CommonStyles.borderBottom,
    borderBottomColor: Colors.borderLight,
    height: 50,
  },
  menuButton: {
    position: 'absolute',
    left: Spacing.sm + 2,
    top: 13,
    zIndex: 1,
  },
  searchButton: {
    position: 'absolute',
    right: Spacing.sm + 2,
    top: 13,
    zIndex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingBottom: INDICATOR_HEIGHT + 4,
  },
  tabText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  tabTextActive: {},
  tabIndicator: {
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: Colors.primary,
  },
  pager: {
    flex: 1,
  },
  tabPage: {
    width: SCREEN_WIDTH,
    flex: 1,
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
