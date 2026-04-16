import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SectionList,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCatalogBrands } from '@/features/catalog/hooks';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';
import { RemoteImage } from '../../components/RemoteImage';

const { width } = Dimensions.get('window');
const ITEM_HEIGHT = 73;
const SECTION_HEADER_HEIGHT = 36;

const priceFilters = [
    { id: 1, label: '1-2千', minPrice: 1000, maxPrice: 2000 },
    { id: 2, label: '2-3千', minPrice: 2000, maxPrice: 3000 },
    { id: 3, label: '3-5千', minPrice: 3000, maxPrice: 5000 },
    { id: 4, label: '>5千', minPrice: 5000, maxPrice: 999999 },
];

const BrandImage = ({ uri, style }: { uri: string; style: any }) => {
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
    const { brands: catalogBrands, loading, error } = useCatalogBrands();

    const [allBrands, setAllBrands] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [popularBrands, setPopularBrands] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeLetter, setActiveLetter] = useState('');
    const sectionListRef = useRef<SectionList>(null);
    const isScrolling = useRef(false);
    const listHeaderHeightRef = useRef(0);

    useEffect(() => {
        if (error) {
            Alert.alert('错误', error);
        }
    }, [error]);

    function groupBrandsByInitial(brandsData: any[]) {
        const grouped: Record<string, any[]> = {};
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
    }

    useEffect(() => {
        if (loading) return;

        const processedBrands = (catalogBrands || [])
            .filter((brand: any) => brand && typeof brand.id !== 'undefined')
            .map((brand: any) => ({
                ...brand,
                initial: brand.pinyin ? brand.pinyin.charAt(0).toUpperCase() : '#'
            }));

        setAllBrands(processedBrands);
        const groupedData = groupBrandsByInitial(processedBrands);
        setBrands(groupedData);
        setPopularBrands(processedBrands.slice(0, 4));

        if (groupedData.length > 0) {
            setActiveLetter(groupedData[0].title);
        } else {
            setActiveLetter('');
        }
    }, [catalogBrands, loading]);

    const filteredBrands = useMemo(() => {
        if (!searchQuery.trim()) return brands;

        const query = searchQuery.trim().toLowerCase();
        const filtered = allBrands.filter(brand =>
            brand.name?.toLowerCase().includes(query) ||
            brand.pinyin?.toLowerCase().includes(query) ||
            brand.english_name?.toLowerCase().includes(query)
        );
        return groupBrandsByInitial(filtered);
    }, [searchQuery, allBrands, brands]);

    const handleBrandPress = (brand: any) => {
        router.push({
            pathname: '/brand/[brandId]',
            params: {
                brandId: String(brand.id),
                brandName: brand.name,
            }
        });
    };

    const handlePriceFilterPress = (filter: typeof priceFilters[0]) => {
        router.push({
            pathname: '/price-vehicles',
            params: {
                minPrice: String(filter.minPrice),
                maxPrice: String(filter.maxPrice),
                title: filter.label,
            }
        });
    };

    const handleLetterPress = (letter: string) => {
        const sectionIndex = filteredBrands.findIndex(section => section.title === letter);

        if (sectionListRef.current && sectionIndex !== -1) {
            setActiveLetter(letter);
            isScrolling.current = true;

            let offset = isSearching ? 0 : listHeaderHeightRef.current;
            for (let i = 0; i < sectionIndex; i++) {
                offset += SECTION_HEADER_HEIGHT + filteredBrands[i].data.length * ITEM_HEIGHT;
            }

            (sectionListRef.current.getScrollResponder() as any)?.scrollTo({
                y: offset,
                animated: false,
            });

            setTimeout(() => {
                isScrolling.current = false;
            }, 500);
        }
    };

    const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        if (isScrolling.current || !viewableItems || viewableItems.length === 0) return;
        const firstSection = viewableItems[0]?.section?.title;
        if (firstSection) {
            setActiveLetter(firstSection);
        }
    }, []);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 1,
        waitForInteraction: true,
    }).current;

    const handleSearchClear = () => {
        setSearchQuery('');
    };

    const isSearching = searchQuery.trim().length > 0;

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
                        style={styles.headerItem}
                        onPress={() => handlePriceFilterPress(filter)}
                    >
                        <Text style={styles.priceFilterText}>{filter.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderAlphabetNav = () => {
        const letters = filteredBrands.map(section => section.title);
        if (letters.length === 0) return null;
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

    const renderBrandItem = ({ item }: { item: any }) => {
        if (!item) return null;
        return (
            <TouchableOpacity style={styles.brandItem} onPress={() => handleBrandPress(item)}>
                <BrandImage uri={item.logo_url} style={styles.brandItemLogo} />
                <View style={styles.brandInfo}>
                    <Text style={styles.brandItemName}>{item.name}</Text>
                    {item.english_name ? <Text style={styles.brandEnglishName}>{item.english_name}</Text> : null}
                </View>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section }: { section: any }) => (
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
                    placeholder="搜索品牌名称/拼音"
                    placeholderTextColor={Colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {isSearching && (
                    <TouchableOpacity onPress={handleSearchClear} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.content}>
                <View style={styles.brandListContainer}>
                    <SectionList
                        ref={sectionListRef}
                        sections={filteredBrands}
                        keyExtractor={(item, index) => (item?.id ? item.id.toString() : `item-${index}`)}
                        renderItem={renderBrandItem}
                        renderSectionHeader={renderSectionHeader}
                        style={styles.brandList}
                        onViewableItemsChanged={handleViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        stickySectionHeadersEnabled
                        ListHeaderComponent={
                            isSearching ? null : (
                                <View onLayout={(e) => {
                                    listHeaderHeightRef.current = e.nativeEvent.layout.height;
                                }}>
                                    {renderPopularBrands()}
                                    {renderPriceFilters()}
                                </View>
                            )
                        }
                        ListEmptyComponent={
                            isSearching ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="search-outline" size={48} color="#ccc" />
                                    <Text style={styles.emptyText}>未找到匹配的品牌</Text>
                                </View>
                            ) : null
                        }
                        onScrollToIndexFailed={() => {}}
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
        color: Colors.textPrimary,
    },
    clearButton: {
        padding: 4,
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
        width: (width - Spacing.lg * 2 - 48) / 4,
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
    priceFilterText: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
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
        right: 4,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        paddingVertical: Spacing.sm,
    },
    letterButton: {
        paddingVertical: 2,
        paddingHorizontal: 5,
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
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyText: {
        marginTop: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.textTertiary,
    },
});

