// app/vehicle/[vehicleId].tsx

import React, { useState, useEffect, useRef } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    FlatList,
    Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { RemoteImage } from '../../components/RemoteImage';

const { width: screenWidth } = Dimensions.get('window');

// 图片展示组件（保持不变）
const ImageGallery = ({ images }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeType, setActiveType] = useState('');
    const flatListRef = useRef(null);

    // 按 image_type 分组图片
    const groupedImages = images?.reduce((acc, image) => {
        const type = image.image_type || '其他';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(image);
        return acc;
    }, {}) || {};

    // 获取所有类型
    const imageTypes = Object.keys(groupedImages);

    // 初始化选中第一个类型
    useEffect(() => {
        if (imageTypes.length > 0 && !activeType) {
            setActiveType(imageTypes[0]);
        }
    }, [imageTypes]);

    // 获取当前类型的图片
    const currentImages = groupedImages[activeType] || [];

    const handleTypePress = (type) => {
        setActiveType(type);
        setActiveIndex(0);
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
    };

    const handleImageScroll = (event) => {
        const contentOffset = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffset / screenWidth);
        setActiveIndex(index);
    };

    const scrollToIndex = (index) => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setActiveIndex(index);
    };

    const renderImageItem = ({ item, index }) => (
        <View style={styles.imageSlide}>
            <RemoteImage
                uri={item.image_url}
                style={styles.mainImage}
                contentFit="contain"
                recyclingKey={item.id != null ? String(item.id) : item.image_url}
            />
        </View>
    );

    if (!images || images.length === 0) {
        return (
            <View style={styles.noImagesContainer}>
                <Ionicons name="image-outline" size={60} color="#ccc" />
                <Text style={styles.noImagesText}>暂无图片</Text>
            </View>
        );
    }

    return (
        <View style={styles.imageGallery}>
            {/* 图片轮播 */}
            <View style={styles.carouselContainer}>
                <FlatList
                    ref={flatListRef}
                    data={currentImages}
                    renderItem={renderImageItem}
                    keyExtractor={(item, index) => `image-${item.id}-${index}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleImageScroll}
                    style={styles.imageList}
                />

                {/* 图片指示器 */}
                {currentImages.length > 1 && (
                    <View style={styles.indicatorContainer}>
                        {currentImages.map((_, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.indicator,
                                    activeIndex === index && styles.activeIndicator
                                ]}
                                onPress={() => scrollToIndex(index)}
                            />
                        ))}
                    </View>
                )}
            </View>

            {/* 图片类型标签 */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeScrollView}
                contentContainerStyle={styles.typeContainer}
            >
                {imageTypes.map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.typeButton,
                            activeType === type && styles.activeTypeButton
                        ]}
                        onPress={() => handleTypePress(type)}
                    >
                        <Text style={[
                            styles.typeText,
                            activeType === type && styles.activeTypeText
                        ]}>
                            {type}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

// 配置信息展示组件 - 修改了尺寸显示方式
const VehicleSpecs = ({ vehicle }) => {
    // 合并长宽高为一个尺寸属性
    const formatDimensions = () => {
        const { length, width, height } = vehicle;
        if (length && width && height) {
            return `${length}×${width}×${height}mm`;
        }
        return '';
    };

    const specs = [
        { label: '车辆类型', value: vehicle.vehicle_type },
        { label: '牌照类型', value: vehicle.license_type },
        { label: '电机品牌', value: vehicle.motor_brand },
        { label: '电机类型', value: vehicle.motor_type },
        { label: '电压', value: vehicle.voltage ? `${vehicle.voltage}V` : '' },
        { label: '功率', value: vehicle.power ? `${vehicle.power}W` : '' },
        { label: '电池类型', value: vehicle.battery_type },
        { label: '电池品牌', value: vehicle.battery_brand },
        { label: '电池容量', value: vehicle.battery_capacity ? `${vehicle.battery_capacity}Ah` : '' },
        { label: '理论续航', value: vehicle.theoretical_range ? `${vehicle.theoretical_range}km` : '' },
        { label: '实际续航', value: vehicle.actual_range ? `${vehicle.actual_range}km` : '' },
        { label: '充电时间', value: vehicle.charging_time ? `${vehicle.charging_time}小时` : '' },
        { label: '电池寿命', value: vehicle.battery_life },
        { label: '可拆卸电池', value: vehicle.removable_battery ? '是' : '否' },
        { label: '最高时速', value: vehicle.max_speed ? `${vehicle.max_speed}km/h` : '' },
        { label: '爬坡能力', value: vehicle.climbing_ability },
        { label: '整备质量', value: vehicle.curb_weight ? `${vehicle.curb_weight}kg` : '' },
        { label: '尺寸', value: formatDimensions() },
        { label: '轴距', value: vehicle.wheelbase ? `${vehicle.wheelbase}mm` : '' },
        { label: '座高', value: vehicle.seat_height ? `${vehicle.seat_height}mm` : '' },
        { label: '离地间隙', value: vehicle.ground_clearance ? `${vehicle.ground_clearance}mm` : '' },
        { label: '前刹车', value: vehicle.front_brake },
        { label: '后刹车', value: vehicle.rear_brake },
        { label: '刹车系统', value: vehicle.brake_system },
        { label: '前悬挂', value: vehicle.front_suspension },
        { label: '后悬挂', value: vehicle.rear_suspension },
        { label: '前轮胎尺寸', value: vehicle.front_tire_size },
        { label: '后轮胎尺寸', value: vehicle.rear_tire_size },
        { label: '轮胎品牌', value: vehicle.tire_brand },
        { label: '轮胎类型', value: vehicle.tire_type },
        { label: 'APP解锁', value: vehicle.unlock_app ? '支持' : '不支持' },
        { label: '蓝牙解锁', value: vehicle.unlock_bluetooth ? '支持' : '不支持' },
        { label: 'NFC解锁', value: vehicle.unlock_nfc ? '支持' : '不支持' },
        { label: '遥控解锁', value: vehicle.unlock_remote ? '支持' : '不支持' },
        { label: '钥匙解锁', value: vehicle.unlock_key ? '支持' : '不支持' },
        { label: '智能系统', value: vehicle.smart_system ? '有' : '无' },
        { label: 'APP名称', value: vehicle.app_name || '无' },
        { label: 'GPS追踪', value: vehicle.gps_tracking ? '有' : '无' },
        { label: '远程控制', value: vehicle.remote_control ? '有' : '无' },
        { label: '防盗系统', value: vehicle.anti_theft_system ? '有' : '无' },
        { label: '显示类型', value: vehicle.display_type },
        { label: '大灯类型', value: vehicle.headlight_type },
        { label: '尾灯类型', value: vehicle.taillight_type },
        { label: '座桶储物', value: vehicle.under_seat_storage ? '有' : '无' },
        { label: '储物容量', value: vehicle.storage_capacity ? `${vehicle.storage_capacity}L` : '' },
        { label: '挂钩', value: vehicle.hook ? '有' : '无' },
        { label: '车架材质', value: vehicle.frame_material },
        //{ label: '防水等级', value: vehicle.waterproof_rating },
    ].filter(spec => spec.value && spec.value !== '' && spec.value !== '无'); // 过滤空值

    const renderSpecItem = ({ item, index }) => (
        <View style={[
            styles.specItem,
            index % 2 === 0 ? styles.specItemEven : styles.specItemOdd
        ]}>
            <Text style={styles.specLabel}>{item.label}</Text>
            <Text style={styles.specValue}>{item.value}</Text>
        </View>
    );

    return (
        <View style={styles.specsContainer}>
            <Text style={styles.specsTitle}>车辆配置</Text>
            <FlatList
                data={specs}
                renderItem={renderSpecItem}
                keyExtractor={(item, index) => `spec-${index}`}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.specsList}
            />
        </View>
    );
};

const VehicleDetailScreen = () => {
    const { vehicleId } = useLocalSearchParams();
    const router = useRouter();

    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!vehicleId) return;

        const fetchVehicleDetail = async () => {
            try {
                const vehicleIdStr = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
                const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_VEHICLE_DETAIL, { vehicle_id: vehicleIdStr }));
                const data = await response.json();

                if (data.code === 0 && data.data) {
                    setVehicle(data.data);
                } else {
                    throw new Error(data.msg || '获取车辆详情失败');
                }
            } catch (e) {
                setError(e.message);
                Alert.alert('错误', e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchVehicleDetail();
    }, [vehicleId]);

    const formatPrice = (min, max) => {
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
        return '暂无报价';
    };

    if (loading) {
        return (
            <View style={CommonStyles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={CommonStyles.loadingTextSmall}>正在加载车辆详情...</Text>
            </View>
        );
    }

    if (error || !vehicle) {
        return (
            <View style={CommonStyles.centerContainer}>
                <Ionicons name="warning-outline" size={60} color={Colors.errorAlt} />
                <Text style={CommonStyles.errorTextAlt}>
                    {error || '车辆信息不存在'}
                </Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.backButtonText}>返回</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={CommonStyles.container}>
            <Stack.Screen
                options={{
                    title: vehicle.model_name || '车辆详情',
                    headerBackTitleVisible: false,
                }}
            />

            <ScrollView style={CommonStyles.scrollView}>
                {/* 图片展示组件 */}
                <ImageGallery images={vehicle.images} />

                {/* 基本信息 */}
                <View style={styles.basicInfo}>
                    <Text style={styles.modelName}>{vehicle.brand_name} - {vehicle.model_name} {vehicle.model_year}款</Text>
                    <Text style={styles.price}>
                        指导价：{formatPrice(vehicle.reference_min_price, vehicle.reference_max_price)}
                    </Text>
                </View>

                {/* 配置信息 */}
                <VehicleSpecs vehicle={vehicle} />

                {/* 底部留白 */}
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    backButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm + 2,
        borderRadius: Spacing.sm,
    },
    backButtonText: {
        color: Colors.white,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    mainImageContainer: {
        height: 250,
        backgroundColor: Colors.backgroundWhite,
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    basicInfo: {
        backgroundColor: Colors.backgroundWhite,
        padding: Spacing.lg,
        ...CommonStyles.borderBottom,
    },
    modelName: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    modelYear: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    price: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: 'normal',
        marginBottom: Spacing.xs,
    },
    brandName: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },
    // 图片展示样式
    imageGallery: {
        backgroundColor: Colors.backgroundWhite,
        marginTop: Spacing.sm,
    },
    typeScrollView: {
        ...CommonStyles.borderBottom,
    },
    typeContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    typeButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 8,
    },
    activeTypeButton: {
        borderBottomWidth: 2,
        borderBottomColor: '#ff2442',
    },
    typeText: {
        fontSize: 14,
        color: '#666',
    },
    activeTypeText: {
        color: Colors.primary,
        fontWeight: '600',
    },
    carouselContainer: {
        height: 280,
    },
    imageList: {
        flex: 1,
    },
    imageSlide: {
        width: screenWidth,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    imageTitle: {
        marginTop: 8,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 30,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.borderDark,
        marginHorizontal: Spacing.xs,
    },
    activeIndicator: {
        backgroundColor: Colors.primary,
        width: 12,
    },
    noImagesContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundWhite,
    },
    noImagesText: {
        marginTop: Spacing.sm,
        color: Colors.textTertiary,
        fontSize: FontSize.sm,
    },
    // 配置信息样式
    specsContainer: {
        backgroundColor: Colors.backgroundWhite,
        marginTop: Spacing.sm,
        padding: Spacing.lg,
    },
    specsTitle: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },
    specsList: {
        paddingBottom: 8,
    },
    specItem: {
        flex: 1,
        padding: 12,
        minHeight: 60,
        justifyContent: 'center',
    },
    specItemEven: {
        backgroundColor: Colors.backgroundLightGray,
    },
    specItemOdd: {
        backgroundColor: Colors.backgroundWhite,
    },
    specLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    specValue: {
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    bottomSpacer: {
        height: 20,
    },
});

export default VehicleDetailScreen;