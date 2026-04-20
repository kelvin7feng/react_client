import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Linking,
  Animated,
  BackHandler,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';

const NUM_COLUMNS = 4;
const ITEM_GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const ITEM_SIZE =
  (SCREEN_WIDTH - ITEM_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const PAGE_SIZE = 60;

type Props = {
  visible: boolean;
  maxCount: number;
  onCancel: () => void;
  onConfirm: (uris: string[]) => void;
};

export default function AlbumPicker({
  visible,
  maxCount,
  onCancel,
  onConfirm,
}: Props) {
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    MediaLibrary.PermissionStatus | null
  >(null);
  const [finalizing, setFinalizing] = useState(false);

  const loadingRef = useRef(false);
  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(true);

  const loadAssets = useCallback(async (reset: boolean) => {
    if (loadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        mediaType: [MediaLibrary.MediaType.photo],
        sortBy: [MediaLibrary.SortBy.creationTime],
        after: reset ? undefined : cursorRef.current,
      });
      cursorRef.current = page.endCursor;
      hasMoreRef.current = page.hasNextPage;
      setEndCursor(page.endCursor);
      setHasMore(page.hasNextPage);
      setAssets((prev) => (reset ? page.assets : [...prev, ...page.assets]));
    } catch {
      // noop
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds([]);
    setAssets([]);
    cursorRef.current = undefined;
    hasMoreRef.current = true;
    setEndCursor(undefined);
    setHasMore(true);

    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setPermissionStatus(status);
      if (status === MediaLibrary.PermissionStatus.GRANTED) {
        loadAssets(true);
      }
    })();
  }, [visible, loadAssets]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= maxCount) {
          Alert.alert('提示', `最多只能选择 ${maxCount} 张图片`);
          return prev;
        }
        return [...prev, id];
      });
    },
    [maxCount]
  );

  const handleConfirm = useCallback(async () => {
    if (selectedIds.length === 0 || finalizing) return;
    setFinalizing(true);
    try {
      const ordered = selectedIds
        .map((id) => assets.find((a) => a.id === id))
        .filter((a): a is MediaLibrary.Asset => !!a);

      const uris = await Promise.all(
        ordered.map(async (asset) => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset.id);
            return info.localUri ?? asset.uri;
          } catch {
            return asset.uri;
          }
        })
      );
      onConfirm(uris);
    } finally {
      setFinalizing(false);
    }
  }, [selectedIds, assets, finalizing, onConfirm]);

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => {
    const index = selectedIds.indexOf(item.id);
    const selected = index >= 0;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => toggleSelect(item.id)}
        style={styles.gridItem}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumb}
          contentFit="cover"
          recyclingKey={item.id}
          transition={0}
        />
        {selected ? <View style={styles.selectedOverlay} /> : null}
        <View style={[styles.numCircle, selected && styles.numCircleActive]}>
          {selected ? (
            <Text style={styles.numText}>{index + 1}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    if (permissionStatus === MediaLibrary.PermissionStatus.DENIED) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="lock-closed" size={40} color="#999" />
          <Text style={styles.emptyText}>未获得相册访问权限</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.emptyBtnText}>前往设置开启</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="images-outline" size={40} color="#666" />
        <Text style={styles.emptyText}>相册中暂无照片</Text>
      </View>
    );
  };

  // 入场 / 出场动画（从底部滑入滑出）
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, slideAnim, mounted]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerBtn}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>所有照片</Text>
            <TouchableOpacity
              disabled={selectedIds.length === 0 || finalizing}
              onPress={handleConfirm}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {finalizing ? (
                <ActivityIndicator size="small" color="#ff2442" />
              ) : (
                <Text
                  style={[
                    styles.confirmBtn,
                    selectedIds.length === 0 && styles.confirmBtnDisabled,
                  ]}
                >
                  完成({selectedIds.length}/{maxCount})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={assets}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={NUM_COLUMNS}
            inverted
            onEndReached={() => {
              if (hasMoreRef.current && !loadingRef.current) loadAssets(false);
            }}
            onEndReachedThreshold={0.5}
            initialNumToRender={40}
            windowSize={7}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.rowWrap}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={
              loading ? (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator color="#888" />
                </View>
              ) : null
            }
          />
        </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 50,
    elevation: 50,
  },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerBtn: {
    color: '#fff',
    fontSize: 15,
    minWidth: 60,
  },
  confirmBtn: {
    color: '#ff2442',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
  },
  confirmBtnDisabled: {
    color: '#555',
  },
  listContent: {
    paddingHorizontal: ITEM_GAP,
  },
  rowWrap: {
    justifyContent: 'flex-start',
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: ITEM_GAP / 2,
    backgroundColor: '#111',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 3,
    borderColor: '#ff2442',
  },
  numCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numCircleActive: {
    backgroundColor: '#ff2442',
    borderColor: '#ff2442',
  },
  numText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: '#ff2442',
    borderRadius: 16,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
