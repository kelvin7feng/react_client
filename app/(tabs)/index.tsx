import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { EventBus, Events, LikeChangedPayload } from '../../config/events';
import { useAuth } from '../../config/auth';
import { formatCount } from '../../config/utils';

// 头部组件
const Header = ({ title = "推荐", onSearch }: { title?: string; onSearch?: () => void }) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.menuButton}>
        <Feather name="menu" size={24} color="black" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity style={styles.searchButton} onPress={onSearch}>
        <Ionicons name="search" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

// 加载状态组件
const LoadingView = () => {
  return (
    <View style={CommonStyles.loadingContainer}>
      <ActivityIndicator size="small" color="gray" />
      <Text style={CommonStyles.loadingText}>数据加载中...</Text>
    </View>
  );
};

// 错误状态组件 - 添加了重试功能
const ErrorView = ({ error, onRetry }) => {
  return (
    <View style={CommonStyles.errorContainer}>
      <Ionicons name="alert-circle" size={50} color={Colors.error} />
      <Text style={CommonStyles.errorText}>加载失败</Text>
      <Text style={CommonStyles.errorSubText}>{error}</Text>
      <TouchableOpacity style={CommonStyles.retryButton} onPress={onRetry}>
        <Text style={CommonStyles.retryButtonText}>点击重试</Text>
      </TouchableOpacity>
    </View>
  );
};

// 瀑布流项组件
const WaterfallItem = ({ item, onPress, onLike }) => {
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.8} onPress={() => onPress(item.id)}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.footer}>
          <Text style={styles.author}>{item.author}</Text>
          <TouchableOpacity style={styles.likesContainer} onPress={(e) => { e.stopPropagation(); onLike(item); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={14} color={item.liked ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.likes, item.liked && { color: Colors.primary }]}>{item.likes > 0 ? ` ${formatCount(item.likes)}` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function Index() {
  const router = useRouter();
  const { userId, isLoggedIn } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isLoadingRef = useRef(false);
  const lastLoadedPageRef = useRef(0);

  const fetchRecommendations = useCallback(async (pageNum = 1, append = false) => {
    if (isLoadingRef.current || (append && lastLoadedPageRef.current >= pageNum)) {
      return;
    }

    try {
      isLoadingRef.current = true;
      lastLoadedPageRef.current = pageNum;
      setError(null);

      if (append) {
        setLoadingMore(true);
      } else if (!refreshing) {
        setLoading(true);
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.RECOMMENDATIONS, { page: pageNum, user_id: userId || 0 }));

      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }

      const data = await response.json();

      if (append) {
        setItems(prevItems => [...prevItems, ...data]);
      } else {
        setItems(data);
      }

      if (data.length < 10) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setPage(pageNum);
    } catch (err) {
      setError(err.message);
      lastLoadedPageRef.current = pageNum - 1;
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [refreshing, userId]);

  const handleRefresh = useCallback(() => {
    if (!isLoggedIn) { router.push('/login'); return; }
    setRefreshing(true);
    lastLoadedPageRef.current = 0;
    setPage(1);
    setHasMore(true);
    fetchRecommendations(1, false);
  }, [fetchRecommendations, isLoggedIn, router]);

  const handleCardLike = useCallback(async (article: any) => {
    if (!isLoggedIn) { router.push('/login'); return; }
    const newLiked = !article.liked;
    const newCount = newLiked ? article.likes + 1 : Math.max(article.likes - 1, 0);

    setItems(prev => prev.map(it =>
      it.id === article.id ? { ...it, liked: newLiked, likes: newCount } : it
    ));

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
        setItems(prev => prev.map(it =>
          it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it
        ));
      }
    } catch {
      setItems(prev => prev.map(it =>
        it.id === article.id ? { ...it, liked: article.liked, likes: article.likes } : it
      ));
    }
  }, [isLoggedIn, userId, router]);

  useEffect(() => {
    fetchRecommendations(1, false);

    const off = EventBus.on(Events.ARTICLE_LIKE_CHANGED, ({ articleId, liked, likeCount }: LikeChangedPayload) => {
      setItems(prev => prev.map(item =>
        item.id === articleId ? { ...item, likes: likeCount, liked } : item
      ));
    });
    return off;
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 600; // 距离底部600像素时触发加载

    // 只有当不在加载中且有更多数据时才触发加载
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (!isLoadingRef.current && hasMore) {
        fetchRecommendations(page + 1, true);
      }
    }
  }, [loadingMore, hasMore, page, fetchRecommendations]);

  const splitIntoColumns = (items, numColumns = 2) => {
    const columns = Array.from({ length: numColumns }, () => []);
    items.forEach((item, index) => {
      columns[index % numColumns].push(item);
    });
    return columns;
  };

  const columns = splitIntoColumns(items);

  // 加载状态显示
  if (loading) {
    return (
      <View style={styles.container}>
        <Header onSearch={() => { if (!isLoggedIn) { router.push('/login'); return; } router.push('/search'); }} />
        <LoadingView />
      </View>
    );
  }

  // 错误状态显示
  if (error) {
    return (
      <View style={styles.container}>
        <Header onSearch={() => { if (!isLoggedIn) { router.push('/login'); return; } router.push('/search'); }} />
        <ErrorView error={error} onRetry={() => fetchRecommendations(1, false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onSearch={() => { if (!isLoggedIn) { router.push('/login'); return; } router.push('/search'); }} />

      <ScrollView
        style={CommonStyles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.columnsContainer}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map(item => (
                <WaterfallItem key={item.id} item={item} onPress={(id) => router.push(`/article/${id}`)} onLike={handleCardLike} />
              ))}
            </View>
          ))}
        </View>

        {/* 加载更多指示器 */}
        {loadingMore && (
          <View style={CommonStyles.loadingMoreContainer}>
            <ActivityIndicator size="small" color={Colors.primaryBlue} />
            <Text style={CommonStyles.loadingMoreText}>加载更多...</Text>
          </View>
        )}

        {/* 没有更多数据的提示 */}
        {!hasMore && (
          <View style={CommonStyles.noMoreContainer}>
            <Text style={CommonStyles.noMoreText}>没有更多数据了</Text>
          </View>
        )}
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
  headerTitle: {
    fontSize: FontSize.xl,
    textAlign: 'center',
    flex: 1,
  },
  menuButton: {
    position: 'absolute',
    left: Spacing.sm + 2,
    top: 13,
  },
  searchButton: {
    position: 'absolute',
    right: Spacing.sm + 2,
    top: 13,
  },
  columnsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xs,
    marginTop: 5,
  },
  column: {
    flex: 1,
    marginHorizontal: 3,
  },
  item: {
    ...CommonStyles.cardMedium,
    borderRadius: Spacing.sm - 2,
  },
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 3 / 4,
    resizeMode: 'cover',
  },
  content: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm - 2,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm - 2,
    paddingVertical: 2,
  },
  likes: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
});