import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../config/styles';
import { RemoteImage } from '../components/RemoteImage';

const VehicleImage = ({ uri, style }: { uri: string; style: any }) => {
    const [imageError, setImageError] = useState(false);

    if (imageError || !uri) {
        return (
            <View style={[style, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={40} color="#ccc" />
            </View>
        );
    }

    return (
        <RemoteImage
            uri={uri}
            style={style}
            onError={() => setImageError(true)}
            contentFit="cover"
        />
    );
};

const formatPriceRange = (min: number, max: number) => {
    const hasMin = !isNaN(min) && min > 0;
    const hasMax = !isNaN(max) && max > 0;

    if (hasMin && hasMax) {
        if (min === max) return `${min.toLocaleString()}`;
        return `${min.toLocaleString()} - ${max.toLocaleString()}`;
    } else if (hasMin) {
        return `${min.toLocaleString()} 起`;
    } else if (hasMax) {
        return `最高 ${max.toLocaleString()}`;
    }
    return '暂无';
};

export default function PriceVehiclesScreen() {
    const { minPrice, maxPrice, title } = useLocalSearchParams<{
        minPrice: string;
        maxPrice: string;
        title: string;
    }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const headerTitle = title ? String(title) : '价格筛选';

    useEffect(() => {
        if (!minPrice || !maxPrice) return;

        const fetchVehicles = async () => {
            try {
                const response = await fetch(
                    buildApiUrl(API_ENDPOINTS.GET_VEHICLES_BY_PRICE, {
                        min_price: minPrice,
                        max_price: maxPrice,
                    })
                );
                const data = await response.json();
                if (data.code === 0) {
                    setVehicles(data.data || []);
                } else {
                    Alert.alert('错误', data.msg || '获取车型失败');
                }
            } catch {
                Alert.alert('错误', '网络请求失败');
            } finally {
                setLoading(false);
            }
        };

        fetchVehicles();
    }, [minPrice, maxPrice]);

    const renderVehicleItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => router.push(`/vehicle/${item.id}`)}
        >
            <VehicleImage uri={item.main_image} style={styles.itemImage} />
            <View style={styles.itemInfo}>
                <Text style={styles.brandTag}>{item.brand_name}</Text>
                <Text style={styles.itemName}>{item.model_name}</Text>
                <Text style={styles.itemPrice}>
                    指导价: {formatPriceRange(item.reference_min_price, item.reference_max_price)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitleText}>{headerTitle}</Text>
            <View style={styles.backBtn} />
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            {loading ? (
                <View style={CommonStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={CommonStyles.loadingTextSmall}>加载中...</Text>
                </View>
            ) : (
                <FlatList
                    data={vehicles}
                    renderItem={renderVehicleItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={CommonStyles.centerContainer}>
                            <Ionicons name="car-outline" size={60} color="#ccc" />
                            <Text style={[CommonStyles.emptyText, { marginTop: Spacing.md }]}>
                                该价格区间暂无车型
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.sm,
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleText: {
        flex: 1,
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    listContent: {
        padding: Spacing.lg,
    },
    itemContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.backgroundWhite,
        borderRadius: Spacing.sm,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        ...Shadows.medium,
    },
    itemImage: {
        width: 100,
        height: 100,
        borderRadius: Spacing.sm,
        marginRight: Spacing.md,
    },
    imagePlaceholder: {
        backgroundColor: Colors.backgroundGray,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    brandTag: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        marginBottom: Spacing.xs,
    },
    itemName: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    itemPrice: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
});
