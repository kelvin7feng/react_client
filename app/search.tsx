import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, SafeAreaView, ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';
import { formatCount } from '../config/utils';
import { RemoteImage } from '../components/RemoteImage';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 20;

const GUESS_TITLES = [
    '新能源车推荐', '自驾游攻略', '改装案例分享',
    '新手买车指南', '用车小技巧', '二手车避坑',
    '车载好物推荐', '养车省钱秘籍', '长途自驾必备',
    '城市代步之选',
];

async function loadHistory(): Promise<string[]> {
    try {
        const json = await AsyncStorage.getItem(HISTORY_KEY);
        return json ? JSON.parse(json) : [];
    } catch {
        return [];
    }
}

async function saveHistory(list: string[]) {
    try {
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
    } catch {}
}

async function addHistory(keyword: string, prev: string[]): Promise<string[]> {
    const trimmed = keyword.trim();
    if (!trimmed) return prev;
    const next = [trimmed, ...prev.filter(k => k !== trimmed)].slice(0, MAX_HISTORY);
    await saveHistory(next);
    return next;
}

export default function SearchScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        loadHistory().then(setHistory);
    }, []);

    const doSearch = useCallback(async (searchKeyword?: string) => {
        const kw = (searchKeyword ?? keyword).trim();
        if (!kw) return;
        setKeyword(kw);
        setLoading(true);
        setSearched(true);

        const updated = await addHistory(kw, history);
        setHistory(updated);

        try {
            const response = await fetch(buildApiUrl(API_ENDPOINTS.SEARCH, {
                keyword: kw, type: 'article', page: 1, user_id: userId || 0,
            }));
            const result = await response.json();
            if (result.code === 0) setResults(result.data || []);
            else setResults([]);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [keyword, userId, history]);

    const removeHistoryItem = useCallback(async (kw: string) => {
        const next = history.filter(k => k !== kw);
        setHistory(next);
        await saveHistory(next);
    }, [history]);

    const clearHistory = useCallback(async () => {
        setHistory([]);
        await saveHistory([]);
    }, []);

    const clearSearch = useCallback(() => {
        setKeyword('');
        setResults([]);
        setSearched(false);
    }, []);

    const renderArticleItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={s.articleItem} onPress={() => router.push(`/article/${item.id}`)}>
            {item.image ? <RemoteImage uri={item.image} style={s.articleImage} contentFit="cover" /> : null}
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

    const renderIdlePage = () => (
        <ScrollView style={s.idlePage} showsVerticalScrollIndicator={false}>
            {history.length > 0 && (
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>搜索历史</Text>
                        <TouchableOpacity onPress={clearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <View style={s.tagsWrap}>
                        {history.map((kw, idx) => (
                            <TouchableOpacity key={`${kw}-${idx}`} style={s.tag} onPress={() => doSearch(kw)}>
                                <Text style={s.tagText} numberOfLines={1}>{kw}</Text>
                                <TouchableOpacity
                                    onPress={() => removeHistoryItem(kw)}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    style={s.tagClose}
                                >
                                    <Ionicons name="close" size={12} color={Colors.textTertiary} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>猜你想搜</Text>
                </View>
                <View style={s.guessGrid}>
                    {GUESS_TITLES.map((title, idx) => (
                        <TouchableOpacity key={idx} style={s.guessItem} onPress={() => doSearch(title)}>
                            <Text style={s.guessText} numberOfLines={1}>{title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </ScrollView>
    );

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
                        placeholder="搜索文章"
                        placeholderTextColor={Colors.textTertiary}
                        value={keyword}
                        onChangeText={setKeyword}
                        onSubmitEditing={() => doSearch()}
                        returnKeyType="search"
                        autoFocus
                    />
                    {keyword ? (
                        <TouchableOpacity onPress={clearSearch}>
                            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity onPress={() => doSearch()} style={s.searchBtn}>
                    <Text style={s.searchBtnText}>搜索</Text>
                </TouchableOpacity>
            </View>

            {!searched ? (
                renderIdlePage()
            ) : loading ? (
                <View style={s.center}><ActivityIndicator size="small" color={Colors.textTertiary} /></View>
            ) : results.length === 0 ? (
                <View style={s.center}>
                    <Ionicons name="search-outline" size={48} color={Colors.borderDark} />
                    <Text style={s.emptyText}>未找到相关内容</Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderArticleItem}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={s.list}
                />
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

    idlePage: { flex: 1, paddingHorizontal: Spacing.lg },
    section: { marginTop: Spacing.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },

    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    tag: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.backgroundGray, borderRadius: 16,
        paddingLeft: Spacing.md, paddingRight: Spacing.xs + 2, paddingVertical: Spacing.xs + 2,
        marginRight: Spacing.sm, marginBottom: Spacing.sm, maxWidth: '48%',
    },
    tagText: { fontSize: FontSize.sm, color: Colors.textSecondary, flexShrink: 1 },
    tagClose: { marginLeft: Spacing.xs, padding: 2 },

    guessGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    guessItem: {
        width: '50%', paddingVertical: Spacing.md - 2,
    },
    guessText: { fontSize: FontSize.sm, color: Colors.textPrimary },
});
