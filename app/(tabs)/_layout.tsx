/*
 * @Descripttion: 
 * @Author: kkfeng@tencent.com
 * @version: 1.0
 * @Date: 2025-04-16 08:53:42
 * @LastEditors: kkfeng@tencent.com
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fetchUnreadCount as fetchUnreadCountSummary } from '@/features/notification/api';
import { useAuth } from '../../config/auth';
import { useWebSocket } from '../../config/useWebSocket';
import {
  ActionSheet,
  AlbumPicker,
} from '../../components/AlbumPicker';
import {
  DeleteDragOverlayHost,
  DeleteDragOverlayProvider,
} from '../../components/DeleteDragOverlay';
import ImageEditor from '../../components/ImageEditor';
import {
  PublishTaskProvider,
  PublishProgressBar,
} from '../../components/PublishTaskManager';

export default function TabLayout() {
    const router = useRouter();
    const { isLoggedIn, token } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [publishSheetVisible, setPublishSheetVisible] = useState(false);
    const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
    const [editorVisible, setEditorVisible] = useState(false);
    const [editorImages, setEditorImages] = useState<string[]>([]);

    const handlePublishPress = () => {
        if (!isLoggedIn) { router.push('/login'); return; }
        setPublishSheetVisible(true);
    };

    const handleChooseFromAlbum = () => {
        setPublishSheetVisible(false);
        setTimeout(() => setAlbumPickerVisible(true), 220);
    };

    const handleAlbumConfirm = (uris: string[]) => {
        if (uris.length === 0) return;
        // 编辑器立即从右滑入；相册由编辑器的 onOpened 回调关闭
        setEditorImages(uris);
        setEditorVisible(true);
    };

    const handleEditorOpened = () => {
        // ImageEditor 完全滑入后，再关闭底下的相册页面
        setAlbumPickerVisible(false);
    };

    const handleEditorCancel = () => {
        setEditorVisible(false);
    };

    const handleEditorClosed = () => {
        setEditorImages([]);
    };

    const handleEditorDone = (finalImages: string[]) => {
        setEditorVisible(false);
        if (finalImages.length === 0) return;
        router.push({
            pathname: '/publish',
            params: { newImages: JSON.stringify(finalImages) },
        });
    };

    const fetchUnreadCount = useCallback(async () => {
        if (!isLoggedIn) { setUnreadCount(0); return; }
        try {
            const data = await fetchUnreadCountSummary();
            setUnreadCount(data.count || 0);
        } catch {}
    }, [isLoggedIn]);

    useWebSocket(
        isLoggedIn ? token : null,
        useCallback((type: string, data: any) => {
            if (type === 'unread_update' && data?.count !== undefined) {
                setUnreadCount(data.count);
            }
        }, []),
    );

    useEffect(() => {
        if (!isLoggedIn) { setUnreadCount(0); return; }
        fetchUnreadCount();
        intervalRef.current = setInterval(fetchUnreadCount, 30000);
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') fetchUnreadCount();
        });
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            sub.remove();
        };
    }, [fetchUnreadCount, isLoggedIn]);

    const authGuardListener = {
        tabPress: (e: any) => {
            if (!isLoggedIn) {
                e.preventDefault();
                router.push('/login');
            }
        },
    };

    return (
        <DeleteDragOverlayProvider>
            <PublishTaskProvider>
            <View style={{ flex: 1 }}>
                <Tabs
                // 自定义 tabBar：在标准 BottomTabBar 顶部叠一条"发布进度条"。
                // 当前聚焦的 screen 若配置了 tabBarStyle.display === 'none'（例如 publish 页）
                // 则完全不渲染 TabBar 区域，避免出现一条悬浮的进度线。
                tabBar={(tabBarProps) => {
                    const focusedKey =
                        tabBarProps.state.routes[tabBarProps.state.index]?.key;
                    const focusedOptions =
                        tabBarProps.descriptors[focusedKey]?.options;
                    const tabBarStyle = focusedOptions?.tabBarStyle as
                        | { display?: 'none' | 'flex' }
                        | undefined;
                    if (tabBarStyle?.display === 'none') {
                        return null;
                    }
                    return (
                        <View>
                            <PublishProgressBar />
                            <BottomTabBar {...tabBarProps} />
                        </View>
                    );
                }}
                screenOptions={{
                    tabBarActiveTintColor: '#000',
                    headerShown: false,
                    headerTintColor: 'black',
                    tabBarStyle: {
                        backgroundColor: '#f8f9fa',
                        height: 72,
                        paddingBottom: 6,
                    },
                    tabBarItemStyle: {
                        justifyContent: 'center',
                        alignItems: 'center',
                    },
                    tabBarLabelStyle: {
                        fontSize: 11,
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: '首页',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="selection"
                    options={{
                        title: '选车',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialCommunityIcons name="motorbike" color={color} size={24} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="publish"
                    options={{
                        title: '',
                        // 发布页需要全屏覆盖（包括底部 Tab 栏），聚焦此 screen 时隐藏 TabBar。
                        // 其它 tab（首页/选车/消息/我的）不受影响，保持各自原有样式。
                        tabBarStyle: { display: 'none' },
                        tabBarButton: () => (
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'flex-start',
                                    alignItems: 'center',
                                    paddingTop: 8,
                                }}
                            >
                                <TouchableOpacity
                                    style={{
                                        width: 50,
                                        height: 38,
                                        borderRadius: 12,
                                        backgroundColor: '#ff2442',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                    onPress={handlePublishPress}
                                >
                                    <Ionicons name="add" size={25} color="#fff" style={{ fontWeight: 'bold' }} />
                                </TouchableOpacity>
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="message"
                    options={{
                        title: '消息',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} size={24} />
                        ),
                        tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
                        tabBarBadgeStyle: { backgroundColor: '#ff2442', fontSize: 10, minWidth: 16, height: 16, lineHeight: 14 },
                    }}
                    listeners={{
                        ...authGuardListener,
                        tabPress: (e: any) => {
                            if (!isLoggedIn) { e.preventDefault(); router.push('/login'); return; }
                            fetchUnreadCount();
                        },
                        focus: () => fetchUnreadCount(),
                    }}
                />
                <Tabs.Screen
                    name="my"
                    options={{
                        title: '我的',
                        tabBarIcon: ({ color, focused }) => (
                            <AntDesign name="user" size={24} color={color} />
                        ),
                    }}
                    listeners={authGuardListener}
                />
                </Tabs>

                <DeleteDragOverlayHost />

                <ActionSheet
                    visible={publishSheetVisible}
                    onClose={() => setPublishSheetVisible(false)}
                    options={[
                        {
                            label: '从手机相册选择',
                            onPress: handleChooseFromAlbum,
                        },
                    ]}
                />

                <AlbumPicker
                    visible={albumPickerVisible}
                    maxCount={9}
                    onCancel={() => setAlbumPickerVisible(false)}
                    onConfirm={handleAlbumConfirm}
                />

                {editorImages.length > 0 ? (
                    <ImageEditor
                        visible={editorVisible}
                        images={editorImages}
                        initialIndex={0}
                        onCancel={handleEditorCancel}
                        onDone={handleEditorDone}
                        onOpened={handleEditorOpened}
                        onClosed={handleEditorClosed}
                    />
                ) : null}
            </View>
            </PublishTaskProvider>
        </DeleteDragOverlayProvider>
    );
}