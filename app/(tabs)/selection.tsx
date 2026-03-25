import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    SectionList,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { RemoteImage } from '../../components/RemoteImage';

const { width, height } = Dimensions.get('window');

const priceFilters = [
    { id: 1, label: "1-2千" },
    { id: 2, label: "2-3千" },
    { id: 3, label: "3-5千" },
    { id: 4, label: ">5千" },
];

const BrandImage = ({ uri, style }) => {
    const [imageError, setImageError] = useState(false);

    if (imageError || !uri) {
        return (
            <View style={[style, { backgroundColor: Colors.backgroundGray, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={20} color="#ccc" />
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

export default function SelectionScreen() {
    const router = useRouter();

    const [brands, setBrands] = useState([]);
    const [popularBrands, setPopularBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPrice, setSelectedPrice] = useState(null);
    const [activeLetter, setActiveLetter] = useState('');
    const sectionListRef = useRef(null);
    const isScrolling = useRef(false);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BRANDS));
                const data = await response.json();

                if (data.code === 0 && Array.isArray(data.data)) {
                    const processedBrands = data.data
                        .filter(brand => {
                            if (!brand || typeof brand.id === 'undefined') {
                                console.warn("--- Found problematic brand object, filtering it out: ---", brand);
                                return false;
                            }
                            return true;
                        })
                        .map(brand => ({
                            ...brand,
                            initial: brand.pinyin ? brand.pinyin.charAt(0).toUpperCase() : '#'
                        }));


                    const groupedData = groupBrandsByInitial(processedBrands);
                    setBrands(groupedData);
                    setPopularBrands(processedBrands.slice(0, 4));


                    if (groupedData.length > 0) {
                        setActiveLetter(groupedData[0].title);
                    }
                } else {
                    Alert.alert('错误', data.msg || '获取品牌数据失败或数据格式不正确');
                }

                setLoading(false);
            } catch (error) {
                Alert.alert('错误', '网络请求失败，请检查网络连接');
                setLoading(false);
            }
        };


        fetchBrands();
    }, []);


    const groupBrandsByInitial = (brandsData) => {
        const grouped = {};
        brandsData.forEach(brand => {
            const initial = brand.initial;
            if (!grouped[initial]) {
                grouped[initial] = [];
            }
            grouped[initial].push(brand);
        });
        return Object.keys(grouped).sort().map(initial => ({
            title: initial,
            data: grouped[initial]
        }));
    };

    const handleBrandPress = (brand) => {
        router.push({
            pathname: `/brand/${brand.id}`,
            params: { brandName: brand.name }
        });
    };

    const handlePriceFilterPress = (filter) => {
        setSelectedPrice(filter.id === selectedPrice ? null : filter.id);
    };

    const handleLetterPress = (letter) => {
        const sectionIndex = brands.findIndex(section => section.title === letter);

        Alert.alert('点击分类', `您选择了: ${sectionIndex}`);
        if (sectionListRef.current && sectionIndex !== -1) {
            setActiveLetter(letter);

        //     // 标记开始滚动，防止 onViewableItemsChanged 干扰
        //     isScrolling.current = true;

        //     // 滚动到对应的分区
        // sectionListRef.current.scrollToLocation({
        //     sectionIndex: sectionIndex,
        //     itemIndex: 0,       // 滚动到该分区的第一个项目
        //     viewPosition: 0,    // 0 = 顶部
        //     animated: false,    // **关键改动**：将 animated 设置为 false 可以极大地提高滚动的准确性
        // });

        //     // 在滚动动画结束后，恢复滚动监听
        //     setTimeout(() => {
        //         isScrolling.current = false;
        //     }, 500);
        }
    };

    const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (isScrolling.current || !viewableItems || viewableItems.length === 0) {
            return;
        }
        const firstVisibleSectionTitle = viewableItems[0].section.title;
        if (firstVisibleSectionTitle && activeLetter !== firstVisibleSectionTitle) {
            setActiveLetter(firstVisibleSectionTitle);
        }
    }, [activeLetter]);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 1,
        waitForInteraction: true,
    }).current;


    const renderPopularBrands = () => (
        <View style={styles.headerListWrapper}>
            <Text style={styles.sectionTitle}>热门品牌</Text>
            <View style={styles.headerListContainer}>
                {popularBrands.map(brand => (
                    <TouchableOpacity
                        key={brand.id}
                        style={styles.headerItem}
                        onPress={() => handleBrandPress(brand)}
                    >
                        <BrandImage uri={brand.logo_url} style={styles.brandLogo} />
                        <Text style={styles.brandName}>{brand.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderPriceFilters = () => (
        <View style={styles.headerListWrapper}>
            <Text style={styles.sectionTitle}>价格区间</Text>
            <View style={styles.headerListContainer}>
                {priceFilters.map(filter => (
                    <TouchableOpacity
                        key={filter.id}
                        style={[styles.headerItem, selectedPrice === filter.id && styles.selectedPriceFilter]}
                        onPress={() => handlePriceFilterPress(filter)}
                    >
                        <Text style={[styles.priceFilterText, selectedPrice === filter.id && styles.selectedPriceFilterText]}>
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderAlphabetNav = () => {
        const letters = brands.map(section => section.title);
        return (
            <View style={styles.alphabetNav}>
                {letters.map(letter => (
                    <TouchableOpacity
                        key={letter}
                        style={[styles.letterButton, activeLetter === letter && styles.activeLetterButton]}
                        onPress={() => handleLetterPress(letter)}
                    >
                        <Text style={[styles.letterText, activeLetter === letter && styles.activeLetterText]}>
                            {letter}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderBrandItem = ({ item }) => {
        if (!item) {
            return null;
        }
        return (
            <TouchableOpacity style={styles.brandItem} onPress={() => handleBrandPress(item)}>
                <BrandImage uri={item.logo_url} style={styles.brandItemLogo} />
                <View style={styles.brandInfo}>
                    <Text style={styles.brandItemName}>{item.name}</Text>
                    {item.english_name && <Text style={styles.brandEnglishName}>{item.english_name}</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={CommonStyles.container}>
                <View style={CommonStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={CommonStyles.loadingTextSmall}>加载中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={CommonStyles.container}>
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="搜索品牌"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>
            <View style={styles.content}>
                <View style={styles.brandListContainer}>
                    <SectionList
                        ref={sectionListRef}
                        sections={brands}
                        keyExtractor={(item, index) => (item && item.id ? item.id.toString() : `item-${index}`)}
                        renderItem={renderBrandItem}
                        renderSectionHeader={renderSectionHeader}
                        style={styles.brandList}
                        onViewableItemsChanged={handleViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        ListHeaderComponent={
                            <View>
                                {renderPopularBrands()}
                                {renderPriceFilters()}
                            </View>
                        }
                    />
                </View>
                {renderAlphabetNav()}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        position: 'relative',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundWhite,
        marginHorizontal: Spacing.lg,
        marginVertical: Spacing.lg,
        paddingHorizontal: Spacing.md,
        borderRadius: Spacing.sm,
        ...Shadows.small,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: FontSize.md,
    },
    sectionTitle: {
        ...CommonStyles.textSectionTitle,
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    headerListWrapper: {
        marginBottom: 2,
    },
    headerListContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        flexWrap: 'wrap',
    },
    headerItem: {
        width: (width - Spacing.lg * 2 - 48) / 4, // 屏幕宽度减去左右边距和项目间距
        alignItems: 'center',
        backgroundColor: Colors.backgroundWhite,
        borderRadius: Spacing.sm,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        ...Shadows.small,
    },
    brandLogo: {
        width: 40,
        height: 40,
        marginBottom: 8,
        borderRadius: 4,
    },
    brandName: {
        fontSize: FontSize.xs,
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    selectedPriceFilter: {
        backgroundColor: Colors.primary,
    },
    priceFilterText: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
    },
    selectedPriceFilterText: {
        color: Colors.white,
    },
    brandListContainer: {
        flex: 1,
    },
    brandList: {
        flex: 1,
    },
    sectionHeader: {
        backgroundColor: Colors.backgroundGray,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    sectionHeaderText: {
        ...CommonStyles.textSectionTitle,
        color: Colors.textSecondary,
    },
    brandItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundWhite,
        padding: Spacing.lg,
        ...CommonStyles.borderBottom,
    },
    brandItemLogo: {
        width: 40,
        height: 40,
        marginRight: 12,
        borderRadius: 4,
    },
    brandInfo: {
        flex: 1,
    },
    brandItemName: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    brandEnglishName: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    alphabetNav: {
        position: 'absolute',
        right: 8,
        top: height * 0.3,
        bottom: 16,
        justifyContent: 'flex-start',
        alignItems: 'center',
        zIndex: 10,
    },
    letterButton: {
        paddingVertical: 2,
        paddingHorizontal: 4,
        marginVertical: 1,
    },
    activeLetterButton: {
        backgroundColor: Colors.primary,
        borderRadius: 10,
    },
    letterText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    activeLetterText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
});

