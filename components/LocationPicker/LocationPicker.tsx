import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  BackHandler,
  Platform,
  StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// 附近位置分页：每一页代表一圈采样半径（米）。页码越大覆盖范围越大。
// 每页 3 个半径 × 6 个方向 = 18 个采样点。首页附加一次中心点反查。
const DISTANCE_PAGES: number[][] = [
  [120, 350, 700],
  [1200, 2000, 3000],
  [5000, 8000, 12000],
  [20000, 30000, 50000],
];
const BEARINGS = [0, 60, 120, 180, 240, 300];
const SEARCH_MAX_RESULTS = 20;

export type LocationDetail = {
  province: string;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
};

type Candidate = {
  id: string;
  label: string;
  subtitle?: string; // "距离 | 详细地址"
  distanceMeters: number;
  detail: LocationDetail;
  isCityHeader?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  // label=null 且 detail=null 表示"不显示位置"。
  onConfirm: (label: string | null, detail: LocationDetail | null) => void;
};

// 以 (lat, lon) 为中心，向 bearingDeg 方向前进 distance 米，返回新的经纬度。
// 用于构造附近多点以做反向地理编码，得到不同街道/区域的候选。
function offsetLatLng(
  lat: number,
  lon: number,
  distance: number,
  bearingDeg: number,
) {
  const R = 6371000;
  const delta = distance / R;
  const theta = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lon * Math.PI) / 180;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
  return {
    latitude: (phi2 * 180) / Math.PI,
    longitude: (lambda2 * 180) / Math.PI,
  };
}

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number) {
  if (!isFinite(m) || m < 0) return '';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function buildAddressLine(g: Location.LocationGeocodedAddress) {
  return (
    [g.city, g.district, g.street || g.name].filter(Boolean).join('') || ''
  );
}

function toLabel(g: Location.LocationGeocodedAddress) {
  return (g.name || g.street || g.district || g.city || '').trim();
}

export default function LocationPicker({
  visible,
  onClose,
  onConfirm,
}: Props) {
  const [center, setCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentCity, setCurrentCity] = useState('');
  const [currentCityDetail, setCurrentCityDetail] =
    useState<LocationDetail | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);

  // 用户点选的项 id；'__none__' 表示选择了"不显示位置"。
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(visible);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 使用 ref 保存去重集合与分页游标，避免跨多次 loadPage 的 stale closure 问题
  const seenRef = useRef<Set<string>>(new Set());
  const pageIndexRef = useRef<number>(-1);
  const loadingMoreRef = useRef<boolean>(false);

  // 入场/出场动画
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

  // Android 硬件返回键
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  // 关闭时重置交互态与分页游标（下次打开需要重新加载）
  useEffect(() => {
    if (!visible) {
      setSearchText('');
      setSearchResults(null);
      setSelectedId(null);
      seenRef.current = new Set();
      pageIndexRef.current = -1;
      loadingMoreRef.current = false;
      setCandidates([]);
      setCenter(null);
      setCurrentCity('');
      setCurrentCityDetail(null);
      setHasMore(true);
    }
  }, [visible]);

  // 加载第 page 页附近候选（按 DISTANCE_PAGES 采样），追加到现有列表。
  // 首页 (page===0) 会再附带一次中心点反查。
  const loadPage = useCallback(
    async (
      page: number,
      centerArg: { latitude: number; longitude: number },
      cityName: string,
    ) => {
      if (loadingMoreRef.current) return;
      if (page >= DISTANCE_PAGES.length) {
        setHasMore(false);
        return;
      }
      loadingMoreRef.current = true;
      setLoadingMore(true);
      try {
        const { latitude: lat, longitude: lon } = centerArg;
        const distances = DISTANCE_PAGES[page];
        const queries: Promise<{
          p: { latitude: number; longitude: number };
          geo: Location.LocationGeocodedAddress | undefined;
        } | null>[] = [];
        if (page === 0) {
          queries.push(
            Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
              .then((arr) => ({
                p: { latitude: lat, longitude: lon },
                geo: arr[0],
              }))
              .catch(() => null),
          );
        }
        for (const d of distances) {
          for (const b of BEARINGS) {
            const p = offsetLatLng(lat, lon, d, b);
            queries.push(
              Location.reverseGeocodeAsync({
                latitude: p.latitude,
                longitude: p.longitude,
              })
                .then((arr) => ({ p, geo: arr[0] }))
                .catch(() => null),
            );
          }
        }
        const results = await Promise.all(queries);
        const fresh: Candidate[] = [];
        for (const r of results) {
          if (!r || !r.geo) continue;
          const g = r.geo;
          const label = toLabel(g);
          if (!label) continue;
          // 避免与城市头重复
          if (cityName && label === cityName) continue;
          const key = `${g.name || ''}|${g.street || ''}|${g.district || ''}|${g.city || ''}`;
          if (seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          const dm = haversine(lat, lon, r.p.latitude, r.p.longitude);
          fresh.push({
            id: key,
            label,
            subtitle: `${formatDistance(dm)} | ${buildAddressLine(g)}`,
            distanceMeters: dm,
            detail: {
              province: g.region || '',
              city: g.city || '',
              district: g.district || '',
              address: g.name || g.street || '',
              latitude: r.p.latitude,
              longitude: r.p.longitude,
            },
          });
        }
        fresh.sort((a, b) => a.distanceMeters - b.distanceMeters);
        setCandidates((prev) => [...prev, ...fresh]);
        pageIndexRef.current = page;
        if (page >= DISTANCE_PAGES.length - 1) setHasMore(false);
      } catch {
        // 网络/权限/设备异常时，降级为空列表
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [],
  );

  // 打开时做一次性的权限获取、当前定位、中心反查、并发起第 0 页加载
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPermissionDenied(true);
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        setPermissionDenied(false);

        const loc = await Location.getCurrentPositionAsync({});
        const lat = loc.coords.latitude;
        const lon = loc.coords.longitude;
        if (cancelled) return;
        const ctr = { latitude: lat, longitude: lon };
        setCenter(ctr);

        const [centerGeo] = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lon,
        });
        if (cancelled) return;
        const city =
          centerGeo?.city ||
          centerGeo?.subregion ||
          centerGeo?.region ||
          '';
        setCurrentCity(city);
        setCurrentCityDetail({
          province: centerGeo?.region || '',
          city,
          district: '',
          address: '',
          latitude: lat,
          longitude: lon,
        });

        await loadPage(0, ctr, city);
      } catch {
        // 网络/权限/设备异常时，降级为空列表
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, loadPage]);

  // 列表触底：加载下一页；搜索模式下由 FlatList 自身数据源控制，不触发分页
  const handleEndReached = useCallback(() => {
    if (searchResults !== null) return;
    if (!center || !hasMore) return;
    if (loadingMoreRef.current) return;
    const next = pageIndexRef.current + 1;
    if (next >= DISTANCE_PAGES.length) {
      setHasMore(false);
      return;
    }
    loadPage(next, center, currentCity);
  }, [searchResults, center, hasMore, currentCity, loadPage]);

  // 搜索：400ms 防抖；调用正向地理编码得到若干坐标，再反查为候选。
  useEffect(() => {
    if (!visible) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchText.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await Location.geocodeAsync(q);
        const list: Candidate[] = [];
        const seen = new Set<string>();
        for (const r of res) {
          let g: Location.LocationGeocodedAddress | undefined;
          try {
            const arr = await Location.reverseGeocodeAsync({
              latitude: r.latitude,
              longitude: r.longitude,
            });
            g = arr[0];
          } catch {
            g = undefined;
          }
          const label = g ? toLabel(g) : q;
          const finalLabel = label || q;
          const key = `${finalLabel}|${r.latitude.toFixed(5)}|${r.longitude.toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const d = center
            ? haversine(
                center.latitude,
                center.longitude,
                r.latitude,
                r.longitude,
              )
            : 0;
          list.push({
            id: key,
            label: finalLabel,
            subtitle: `${formatDistance(d)} | ${g ? buildAddressLine(g) : ''}`,
            distanceMeters: d,
            detail: {
              province: g?.region || '',
              city: g?.city || '',
              district: g?.district || '',
              address: g?.name || g?.street || '',
              latitude: r.latitude,
              longitude: r.longitude,
            },
          });
        }
        list.sort((a, b) => a.distanceMeters - b.distanceMeters);
        setSearchResults(list.slice(0, MAX_ITEMS));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchText, visible, center]);

  const listData: Candidate[] = useMemo(() => {
    if (searchResults !== null) return searchResults;
    const out: Candidate[] = [];
    if (currentCity && currentCityDetail) {
      out.push({
        id: '__city__',
        label: currentCity,
        distanceMeters: 0,
        detail: currentCityDetail,
        isCityHeader: true,
      });
    }
    out.push(...candidates);
    return out;
  }, [searchResults, currentCity, currentCityDetail, candidates]);

  const handleConfirm = () => {
    if (selectedId === '__none__') {
      onConfirm(null, null);
      return;
    }
    if (selectedId) {
      const found = listData.find((x) => x.id === selectedId);
      if (found) {
        onConfirm(found.label, found.detail);
        return;
      }
    }
    // 未选择任何项：等价于取消（不修改现有值）
    onClose();
  };

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.headerBtn}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>位置</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>
              完成
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索位置"
            placeholderTextColor="#999"
            returnKeyType="search"
          />
          {searchText ? (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color="#bbb" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.noneRow}
          activeOpacity={0.6}
          onPress={() => setSelectedId('__none__')}
        >
          <Text style={styles.noneText}>不显示位置</Text>
          {selectedId === '__none__' ? (
            <Ionicons name="checkmark" size={18} color="#4a8fff" />
          ) : null}
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#999" />
          </View>
        ) : permissionDenied ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.emptyText}>未获得位置权限</Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              searching || loadingMore ? null : (
                <View style={styles.loadingWrap}>
                  <Text style={styles.emptyText}>
                    {searchResults !== null ? '未找到相关位置' : '暂无附近位置'}
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              searching || loadingMore ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#999" />
                </View>
              ) : searchResults === null && !hasMore && listData.length > 1 ? (
                <View style={styles.loadingWrap}>
                  <Text style={styles.emptyText}>没有更多位置</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.6}
                onPress={() => setSelectedId(item.id)}
              >
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.rowTitle,
                      item.isCityHeader && styles.rowTitleCity,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {!item.isCityHeader && item.subtitle ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                {selectedId === item.id ? (
                  <Ionicons name="checkmark" size={18} color="#4a8fff" />
                ) : null}
              </TouchableOpacity>
            )}
          />
        )}
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
    backgroundColor: '#fff',
    zIndex: 100,
    elevation: 100,
  },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerBtn: {
    color: '#333',
    fontSize: 15,
    minWidth: 40,
  },
  // 完成按钮保持与 AlbumPicker/发布按钮一致的主题红色 (#ff2442)
  headerBtnPrimary: {
    color: '#ff2442',
    fontWeight: '600',
    textAlign: 'right',
  },

  searchWrap: {
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 10,
    backgroundColor: '#f2f3f5',
    borderRadius: 8,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },

  noneRow: {
    marginTop: 6,
    paddingHorizontal: 16,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  noneText: {
    color: '#4a8fff',
    fontSize: 15,
    fontWeight: '500',
  },

  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },

  row: {
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  rowText: {
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  rowTitleCity: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
