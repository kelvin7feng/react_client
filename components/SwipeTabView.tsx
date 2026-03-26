import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    ScrollView,
    StyleSheet,
    Animated,
    Easing,
    TouchableOpacity,
    Dimensions,
    NativeSyntheticEvent,
    NativeScrollEvent,
    ViewStyle,
} from 'react-native';
import { Colors, Spacing, FontSize } from '../config/styles';

const SCREEN_WIDTH = Dimensions.get('window').width;
const INDICATOR_WIDTH = 26;
const INDICATOR_HEIGHT = 2.5;

export interface TabDef {
    key: string;
    label: string;
}

interface SwipeTabViewProps {
    tabs: TabDef[];
    initialIndex?: number;
    onTabChange?: (key: string, index: number) => void;
    renderHeader?: (tabBar: React.ReactNode) => React.ReactNode;
    tabBarStyle?: ViewStyle;
    children: React.ReactNode;
}

export function SwipeTabView({
    tabs,
    initialIndex = 0,
    onTabChange,
    renderHeader,
    tabBarStyle,
    children,
}: SwipeTabViewProps) {
    const pagerRef = useRef<ScrollView>(null);
    const isTabSwitchingRef = useRef(false);
    const tabCentersRef = useRef<number[]>(tabs.map(() => 0));
    const scrollX = useRef(new Animated.Value(initialIndex * SCREEN_WIDTH)).current;
    const activeIndexRef = useRef(initialIndex);

    const [indicatorStyle, setIndicatorStyle] = useState<{ left: any; width: any }>({
        left: 0,
        width: INDICATOR_WIDTH,
    });

    const buildIndicatorStyle = useCallback(() => {
        const centers = tabCentersRef.current;
        if (centers.some(c => c === 0)) return { left: 0, width: INDICATOR_WIDTH };

        const pageInputRange = tabs.map((_, i) => i * SCREEN_WIDTH);
        const animCenter = scrollX.interpolate({
            inputRange: pageInputRange,
            outputRange: centers,
            extrapolate: 'clamp',
        });

        const widthStops: number[] = [];
        const widthValues: number[] = [];
        for (let i = 0; i < tabs.length; i++) {
            widthStops.push(i * SCREEN_WIDTH);
            widthValues.push(INDICATOR_WIDTH);
            if (i < tabs.length - 1) {
                widthStops.push((i + 0.5) * SCREEN_WIDTH);
                widthValues.push(INDICATOR_WIDTH * 1.8);
            }
        }
        const animWidth = scrollX.interpolate({
            inputRange: widthStops,
            outputRange: widthValues,
            extrapolate: 'clamp',
        });

        const animLeft = Animated.subtract(animCenter, Animated.divide(animWidth, 2));
        return { left: animLeft, width: animWidth };
    }, [scrollX, tabs]);

    const rebuildIndicator = useCallback(() => {
        setIndicatorStyle(buildIndicatorStyle());
    }, [buildIndicatorStyle]);

    const handleTabPress = useCallback((index: number) => {
        const fromIdx = activeIndexRef.current;
        if (index === fromIdx) return;

        const toX = index * SCREEN_WIDTH;
        const fromX = fromIdx * SCREEN_WIDTH;

        isTabSwitchingRef.current = true;
        activeIndexRef.current = index;
        onTabChange?.(tabs[index].key, index);

        const driver = new Animated.Value(fromX);
        driver.addListener(({ value }) => {
            pagerRef.current?.scrollTo({ x: value, animated: false });
        });

        Animated.timing(driver, {
            toValue: toX,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start(() => {
            driver.removeAllListeners();
            isTabSwitchingRef.current = false;
        });
    }, [tabs, onTabChange]);

    const onPagerScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        {
            useNativeDriver: false,
            listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                if (!isTabSwitchingRef.current) {
                    const pageFloat = e.nativeEvent.contentOffset.x / SCREEN_WIDTH;
                    const roundedIdx = Math.max(0, Math.min(Math.round(pageFloat), tabs.length - 1));
                    if (roundedIdx !== activeIndexRef.current) {
                        activeIndexRef.current = roundedIdx;
                        onTabChange?.(tabs[roundedIdx].key, roundedIdx);
                    }
                }
            },
        }
    );

    const tabBar = (
        <View style={[styles.tabBar, tabBarStyle]}>
            {tabs.map((tab, idx) => {
                const textColor = scrollX.interpolate({
                    inputRange: tabs.map((_, i) => i * SCREEN_WIDTH),
                    outputRange: tabs.map((_, i) => (i === idx ? Colors.textPrimary : Colors.textTertiary)),
                    extrapolate: 'clamp',
                });
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.tabItem}
                        onPress={() => handleTabPress(idx)}
                        onLayout={(e) => {
                            const { x, width } = e.nativeEvent.layout;
                            tabCentersRef.current[idx] = x + width / 2;
                            if (tabCentersRef.current.every(c => c > 0)) rebuildIndicator();
                        }}
                    >
                        <Animated.Text style={[styles.tabText, { color: textColor }]}>
                            {tab.label}
                        </Animated.Text>
                    </TouchableOpacity>
                );
            })}
            <Animated.View
                style={[
                    styles.tabIndicator,
                    { position: 'absolute', bottom: 0, left: indicatorStyle.left, width: indicatorStyle.width },
                ]}
            />
        </View>
    );

    const childArray = React.Children.toArray(children);

    return (
        <>
            {renderHeader ? renderHeader(tabBar) : tabBar}
            <ScrollView
                ref={pagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={onPagerScroll}
                contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
                style={styles.pager}
            >
                {childArray.map((child, idx) => (
                    <View key={tabs[idx]?.key ?? idx} style={styles.page}>
                        {child}
                    </View>
                ))}
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xl,
    },
    tabItem: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xs,
        paddingBottom: INDICATOR_HEIGHT + 4,
    },
    tabText: {
        fontSize: FontSize.md,
        color: Colors.textTertiary,
    },
    tabIndicator: {
        height: INDICATOR_HEIGHT,
        borderRadius: INDICATOR_HEIGHT / 2,
        backgroundColor: Colors.primary,
    },
    pager: {
        flex: 1,
    },
    page: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
});
