import { useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, FlatList,
    StyleSheet, SafeAreaView, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { Colors, Spacing, FontSize, Shadows } from '../config/styles';
import { useAuth } from '../config/auth';
import { formatCount } from '../config/utils';

const SEARCH_TYPES = [
    { key: 'article', label: '文章' },
    { key: 'vehicle', label: '车型' },
    { key: 'user', label: '用户' },
] as const;

type SearchType = typeof SEARCH_TYPES[number]['key'];

export default function SearchScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const [keyword, setKeyword] = useState('');
    const [searchType, setSearchType] = useState<SearchType>('article');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const doSearch = useCallback(async () => {
        if (!keyword.trim()) return;
        setLoading(true);
        setSearched(true);
        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.SEARCH, {
                keyword: keyword.trim(), type: searchType, page: 1, user_id: userId || 0,
            }));
            const result = await response.json();
            if (result.code === 0) setResults(result.data || []);
            else setResults([]);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [keyword, searchType, userId]);

    const renderArticleItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={s.articleItem} onPress={() => router.push(`/article/${item.id}`)}>
            {item.image ? <Image source={{ uri: item.image }} style={s.articleImage} /> : null}
            <View style={s.articleInfo}>
                <Text style={s.articleTitle} numberOfLines={2}>{item.title}</Text>
                <View style={s.articleMeta}>
                    <Text style={s.articleAuthor}>{item.author}</Text>
                    <View style={s.articleLikes}>
                        <Ionicons name="heart" size={12} color={Colors.textTertiary} />
                        <Text style={s.articleLikesText}>{formatCount(item.likes || 0)}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderVehicleItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={s.articleItem} onPress={() => router.push(`/vehicle/${item.id}`)}>
            {item.main_image ? <Image source={{ uri: item.main_image }} style={s.articleImage} /> : null}
            <View style={s.articleInfo}>
                <Text style={s.articleTitle}>{item.model_name}</Text>
                <Text style={s.articleAuthor}>{item.brand_name}</Text>
                {(item.reference_min_price > 0 || item.reference_max_price > 0) && (
                    <Text style={s.priceText}>
                        ¥{item.reference_min_price} - ¥{item.reference_max_price}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderUserItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={s.userItem}>
            <Image source={{ uri: item.avatar || 'https://picsum.photos/80/80' }} style={s.userAvatar} />
            <View style={s.userInfo}>
                <Text style={s.userName}>{item.username}</Text>
                <Text style={s.userSig} numberOfLines={1}>{item.signature || '暂无签名'}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderItem = searchType === 'article' ? renderArticleItem : searchType === 'vehicle' ? renderVehicleItem : renderUserItem;

    return (
        <SafeAreaView style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={s.searchBar}>
                    <Ionicons name="search" size={18} color={Colors.textTertiary} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="搜索文章、车型、用户"
                        placeholderTextColor={Colors.textTertiary}
                        value={keyword}
                        onChangeText={setKeyword}
                        onSubmitEditing={doSearch}
                        returnKeyType="search"
                        autoFocus
                    />
                    {keyword ? (
                        <TouchableOpacity onPress={() => { setKeyword(''); setResults([]); setSearched(false); }}>
                            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity onPress={doSearch} style={s.searchBtn}>
                    <Text style={s.searchBtnText}>搜索</Text>
                </TouchableOpacity>
            </View>

            <View style={s.tabs}>
                {SEARCH_TYPES.map(t => (
                    <TouchableOpacity key={t.key} style={[s.tab, searchType === t.key && s.tabActive]}
                        onPress={() => { setSearchType(t.key); if (keyword.trim()) setTimeout(doSearch, 0); }}>
                        <Text style={[s.tabText, searchType === t.key && s.tabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>
            ) : searched && results.length === 0 ? (
                <View style={s.center}>
                    <Ionicons name="search-outline" size={48} color={Colors.borderDark} />
                    <Text style={s.emptyText}>未找到相关内容</Text>
                </View>
            ) : (
                <FlatList data={results} renderItem={renderItem} keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={s.list} />
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    backBtn: { padding: 4, marginRight: Spacing.xs },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundGray,
        borderRadius: 20, paddingHorizontal: Spacing.md, height: 36,
    },
    searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, marginLeft: Spacing.sm, padding: 0 },
    searchBtn: { marginLeft: Spacing.sm, paddingHorizontal: Spacing.md },
    searchBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
    tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md },
    tab: { paddingVertical: Spacing.md, marginRight: Spacing.xl },
    tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
    tabText: { fontSize: FontSize.md, color: Colors.textSecondary },
    tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.textTertiary },
    list: { padding: Spacing.md },
    articleItem: {
        flexDirection: 'row', paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    articleImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: Colors.backgroundGray, marginRight: Spacing.md },
    articleInfo: { flex: 1, justifyContent: 'center' },
    articleTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, lineHeight: 22, marginBottom: 4 },
    articleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    articleAuthor: { fontSize: FontSize.xs, color: Colors.textSecondary },
    articleLikes: { flexDirection: 'row', alignItems: 'center' },
    articleLikesText: { fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: 3 },
    priceText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: 4 },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    userAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: Spacing.md, backgroundColor: Colors.backgroundGray },
    userInfo: { flex: 1 },
    userName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
    userSig: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
