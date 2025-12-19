import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    StyleSheet,
    Image,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';

// 可复用的图片组件，处理加载失败的情况
const VehicleImage = ({ uri, style }) => {
    const [imageError, setImageError] = useState(false);

    if (imageError || !uri) {
        return (
            <View style={[style, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={40} color="#ccc" />
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={style}
            onError={() => setImageError(true)}
            resizeMode="cover"
        />
    );
};

// 帮助函数：格式化价格区间，使其更友好
const formatPriceRange = (min, max) => {
    const minPrice = parseFloat(min);
    const maxPrice = parseFloat(max);

    const hasMin = !isNaN(minPrice) && minPrice > 0;
    const hasMax = !isNaN(maxPrice) && maxPrice > 0;

    if (hasMin && hasMax) {
        if (minPrice === maxPrice) {
            return `${minPrice.toLocaleString()}`;
        }
        return `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
    } else if (hasMin) {
        return `${minPrice.toLocaleString()} 起`;
    } else if (hasMax) {
        return `最高 ${maxPrice.toLocaleString()}`;
    }

    return '暂无';
};

const BrandVehiclesScreen = () => {
    // 从路由参数中获取 brandId 和 brandName
    const { brandId, brandName } = useLocalSearchParams();

    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        if (!brandId) return;

        const fetchVehicles = async () => {
            try {
                const brandIdStr = Array.isArray(brandId) ? brandId[0] : brandId;
                const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_VEHICLES, { brand_id: brandIdStr }));
                const data = await response.json();

                // --- 主要修改点在这里 ---
                // 只要 code 是 0 就认为是成功请求
                if (data.code === 0) {
                    // 如果 data.data 是数组，则使用它；如果是 null，则使用空数组 []
                    setVehicles(data.data || []);
                } else {
                    // 只有当 code 不为 0 时，才认为是错误
                    throw new Error(data.msg || '获取车型数据失败');
                }
            } catch (e) {
                setError(e.message);
                Alert.alert('错误', e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchVehicles();
    }, [brandId]); // 当 brandId 变化时重新请求

    const handleVehiclePress = (vehicle) => {
        router.push(`/vehicle/${vehicle.id}`);
    };

    const renderVehicleItem = ({ item }) => (
        <TouchableOpacity style={styles.itemContainer} onPress={() => handleVehiclePress(item)}>
            <VehicleImage uri={item.main_image} style={styles.itemImage} />
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.model_name}</Text>
                <Text style={styles.itemPrice}>
                    指导价: {formatPriceRange(item.reference_min_price, item.reference_max_price)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#ff2442" />
                <Text style={styles.loadingText}>正在加载车型...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>加载失败: {error}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen
                options={{
                    title: brandName ? String(brandName) : '品牌车型',
                    headerBackTitleVisible: false,
                }}
            />
            <FlatList
                data={vehicles}
                renderItem={renderVehicleItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>该品牌下暂无车型数据</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    errorText: {
        color: '#d9534f',
        fontSize: 16,
        textAlign: 'center',
    },
    emptyText: {
        color: '#999',
        fontSize: 16,
    },
    listContent: {
        padding: 16,
    },
    itemContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    itemImage: {
        width: 100,
        height: 100,
        borderRadius: 8,
        marginRight: 12,
    },
    imagePlaceholder: {
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    itemPrice: {
        fontSize: 14,
        color: '#666',
        fontWeight: 'normal',
    }
});

export default BrandVehiclesScreen;