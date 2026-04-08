import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RemoteImage } from './RemoteImage';
import { Colors, Spacing, FontSize, CommonStyles } from '../config/styles';
import { formatCount } from '../config/utils';

/** 推荐 / 个人页瀑布流卡片所需字段（接口可多返字段，按需取用） */
export type WaterfallArticleItem = {
    id: number;
    image?: string | null;
    title: string;
    author: string;
    author_id?: number;
    likes: number;
    liked?: boolean;
};

export type WaterfallArticleCardProps = {
    item: WaterfallArticleItem;
    onPress: (id: number) => void;
    onLike: (item: WaterfallArticleItem) => void;
    onAuthorPress?: (authorId: number) => void;
    /** 无封面图时是否显示占位（与「我的」一致；设为 false 则顶部留空） */
    showImagePlaceholder?: boolean;
    style?: StyleProp<ViewStyle>;
};

export function WaterfallArticleCard({
    item,
    onPress,
    onLike,
    onAuthorPress,
    showImagePlaceholder = true,
    style,
}: WaterfallArticleCardProps) {
    return (
        <TouchableOpacity style={[styles.card, style]} activeOpacity={0.8} onPress={() => onPress(item.id)}>
            {item.image ? (
                <RemoteImage
                    uri={item.image}
                    style={styles.image}
                    contentFit="cover"
                    recyclingKey={String(item.id)}
                />
            ) : showImagePlaceholder ? (
                <View style={[styles.image, styles.imagePlaceholder]}>
                    <Ionicons name="image-outline" size={24} color={Colors.borderDark} />
                </View>
            ) : null}
            <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                </Text>
                <View style={styles.footer}>
                    {onAuthorPress && item.author_id ? (
                        <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={(e) => { e.stopPropagation(); onAuthorPress(item.author_id!); }}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
                    )}
                    <TouchableOpacity
                        style={styles.likeBtn}
                        onPress={(e) => {
                            e.stopPropagation();
                            onLike(item);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons
                            name={item.liked ? 'heart' : 'heart-outline'}
                            size={14}
                            color={item.liked ? Colors.primary : Colors.textSecondary}
                        />
                        <Text style={[styles.likeText, item.liked && { color: Colors.primary }]}>
                            {item.likes > 0 ? ` ${formatCount(item.likes)}` : ''}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
}

/** 将数据按列交错拆分，用于双列瀑布流 */
export function splitIntoWaterfallColumns<T>(items: T[], numColumns = 2): T[][] {
    const columns = Array.from({ length: numColumns }, () => [] as T[]);
    items.forEach((item, index) => {
        columns[index % numColumns].push(item);
    });
    return columns;
}

export type WaterfallTwoColumnGridProps<T> = {
    items: T[];
    keyExtractor: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    numColumns?: number;
    containerStyle?: StyleProp<ViewStyle>;
    columnStyle?: StyleProp<ViewStyle>;
};

/** 双列瀑布流外层布局（含列间距与推荐/我的页一致的 padding） */
export function WaterfallTwoColumnGrid<T>({
    items,
    keyExtractor,
    renderItem,
    numColumns = 2,
    containerStyle,
    columnStyle,
}: WaterfallTwoColumnGridProps<T>) {
    const columns = splitIntoWaterfallColumns(items, numColumns);
    return (
        <View style={[styles.grid, containerStyle]}>
            {columns.map((column, columnIndex) => (
                <View key={columnIndex} style={[styles.gridColumn, columnStyle]}>
                    {column.map((item) => (
                        <View key={keyExtractor(item)}>{renderItem(item)}</View>
                    ))}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        ...CommonStyles.cardMedium,
        borderRadius: Spacing.sm - 2,
    },
    image: {
        width: '100%',
        aspectRatio: 3 / 4,
        backgroundColor: Colors.backgroundGray,
    },
    imagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    body: {
        padding: Spacing.sm,
    },
    title: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: Spacing.sm - 2,
        color: Colors.textPrimary,
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    author: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        flex: 1,
    },
    likeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: Spacing.sm,
        paddingHorizontal: Spacing.sm - 2,
        paddingVertical: 2,
    },
    likeText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: '300',
    },
    grid: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xs,
        marginTop: 5,
    },
    gridColumn: {
        flex: 1,
        marginHorizontal: 3,
    },
});
