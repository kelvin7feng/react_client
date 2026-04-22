import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useVehiclesByBrand } from '@/features/catalog/hooks';
import type { VehicleBrief } from '@/features/catalog/types';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';
import { LoadingStateView } from '@/components/LoadingStateView';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { RemoteImage } from '../../components/RemoteImage';

const VehicleImage = ({ uri, style }: { uri?: string; style: any }) => {
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

const formatPriceRange = (min?: number | string, max?: number | string) => {
    const minPrice = parseFloat(String(min ?? ''));
    const maxPrice = parseFloat(String(max ?? ''));
    const hasMin = !isNaN(minPrice) && minPrice > 0;
    const hasMax = !isNaN(maxPrice) && maxPrice > 0;

    if (hasMin && hasMax) {
        if (minPrice === maxPrice) return `${minPrice.toLocaleString()}`;
        return `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
    } else if (hasMin) {
        return `${minPrice.toLocaleString()} 起`;
    } else if (hasMax) {
        return `最高 ${maxPrice.toLocaleString()}`;
    }
    return '暂无';
};

const BrandVehiclesScreen = () => {
    const { brandId, brandName } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const brandIdStr = Array.isArray(brandId) ? brandId[0] : brandId;
    const { vehicles, loading, error } = useVehiclesByBrand(brandIdStr);

    const title = brandName ? String(brandName) : '品牌车型';

    useEffect(() => {
        if (error) {
            Alert.alert('错误', error);
        }
    }, [error]);

    const renderVehicleItem = ({ item }: { item: VehicleBrief }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => router.push({ pathname: '/vehicle/[vehicleId]', params: { vehicleId: String(item.id) } })}
        >
            <VehicleImage uri={item.main_image} style={styles.itemImage} />
            <View style={styles.itemInfo}>
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
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.backBtn} />
        </View>
    );

    if (loading) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <LoadingStateView
                    text="正在加载车型..."
                    size={28}
                    color={Colors.primary}
                    style={CommonStyles.centerContainer}
                    textStyle={CommonStyles.loadingTextSmall}
                />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <View style={CommonStyles.centerContainer}>
                    <Text style={CommonStyles.errorTextAlt}>加载失败: {error}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {renderHeader()}
            <FlatList
                data={vehicles}
                renderItem={renderVehicleItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={CommonStyles.centerContainer}>
                        <Text style={CommonStyles.emptyText}>该品牌下暂无车型数据</Text>
                    </View>
                }
            />
        </View>
    );
};

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
    headerTitle: {
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

export default BrandVehiclesScreen;
