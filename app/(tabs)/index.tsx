import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';

// 头部组件
const Header = ({ title = "推荐" }) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.menuButton}>
        <Feather name="menu" size={24} color="black" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity style={styles.searchButton}>
        <Ionicons name="search" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

// 加载状态组件
const LoadingView = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color="gray" />
      <Text style={styles.loadingText}>数据加载中...</Text>
    </View>
  );
};

// 错误状态组件 - 添加了重试功能
const ErrorView = ({ error, onRetry }) => {
  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={50} color="#FF3B30" />
      <Text style={styles.errorText}>加载失败</Text>
      <Text style={styles.errorSubText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>点击重试</Text>
      </TouchableOpacity>
    </View>
  );
};

// 瀑布流项组件
const WaterfallItem = ({ item }) => {
  return (
    <View style={styles.item}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.footer}>
          <Text style={styles.author}>{item.author}</Text>
          <View style={styles.likesContainer}>
            <Text style={styles.likes}>♡ {item.likes}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function Index() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // 使用 ref 来跟踪是否正在加载和上次加载的页码
  const isLoadingRef = useRef(false);
  const lastLoadedPageRef = useRef(0);

  // 从API获取推荐数据
  const fetchRecommendations = useCallback(async (pageNum = 1, append = false) => {
    // 如果已经在加载或已经加载过这一页，则跳过
    if (isLoadingRef.current || lastLoadedPageRef.current >= pageNum) {
      return;
    }

    try {
      isLoadingRef.current = true;
      lastLoadedPageRef.current = pageNum;
      setError(null); // 清除之前的错误

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`http://119.28.108.105:8090/recommendations?page=${pageNum}`);

      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }

      const data = await response.json();

      if (append) {
        setItems(prevItems => [...prevItems, ...data]);
      } else {
        setItems(data);
      }

      // 假设如果返回的数据少于10条，说明没有更多数据了
      if (data.length < 10) {
        setHasMore(false);
      }

      setPage(pageNum);
    } catch (err) {
      setError(err.message);
      // 发生错误时重置最后加载的页码
      lastLoadedPageRef.current = pageNum - 1;
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchRecommendations(1, false);
  }, [fetchRecommendations]);

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
        <Header />
        <LoadingView />
      </View>
    );
  }

  // 错误状态显示
  if (error) {
    return (
      <View style={styles.container}>
        <Header />
        <ErrorView error={error} onRetry={() => fetchRecommendations(1, false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.columnsContainer}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map(item => (
                <WaterfallItem key={item.id} item={item} />
              ))}
            </View>
          ))}
        </View>

        {/* 加载更多指示器 */}
        {loadingMore && (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingMoreText}>加载更多...</Text>
          </View>
        )}

        {/* 没有更多数据的提示 */}
        {!hasMore && (
          <View style={styles.noMoreContainer}>
            <Text style={styles.noMoreText}>没有更多数据了</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 50,
  },
  headerTitle: {
    fontSize: 20,
    textAlign: 'center',
    flex: 1,
  },
  menuButton: {
    position: 'absolute',
    left: 10,
    top: 13,
  },
  searchButton: {
    position: 'absolute',
    right: 10,
    top: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  errorSubText: {
    marginTop: 5,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1
  },
  columnsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginTop: 5
  },
  column: {
    flex: 1,
    marginHorizontal: 3
  },
  item: {
    backgroundColor: 'white',
    borderRadius: 6,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 3 / 4,
    resizeMode: 'cover',
  },
  content: {
    padding: 8
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  author: {
    fontSize: 12,
    color: '#666'
  },
  likesContainer: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  likes: {
    fontSize: 12,
    color: 'black',
    fontWeight: '300'
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  loadingMoreText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#8E8E93',
  },
  noMoreContainer: {
    padding: 10,
    alignItems: 'center',
  },
  noMoreText: {
    fontSize: 14,
    color: '#8E8E93',
  }
});