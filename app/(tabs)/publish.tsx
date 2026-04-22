import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StyleSheet,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CommonStyles, Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';
import {
    DELETE_DRAG_IDLE_STATE,
    useDeleteDragOverlay,
} from '../../components/DeleteDragOverlay';
import ImageEditor from '../../components/ImageEditor';
import DraggableThumbList from '../../components/ImageEditor/DraggableThumbList';
import {
  ActionSheet,
  AlbumPicker,
} from '../../components/AlbumPicker';
import { LocationPicker } from '../../components/LocationPicker';
import { usePublishTask } from '../../components/PublishTaskManager';
import {
    VisibilityPicker,
    VISIBILITY_CODE,
    VISIBILITY_LABELS,
    type VisibilityOption,
} from '../../components/VisibilityPicker';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';

const DRAFT_KEY = 'publish_draft';

type LocationDetail = {
    province: string;
    city: string;
    district: string;
    address: string;
    latitude: number;
    longitude: number;
};

export default function PublishScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ newImages?: string }>();
    const { userId } = useAuth();
    const { submit: submitPublish, publishing: globalPublishing } = usePublishTask();
    const handledNewImagesRef = useRef<string | null>(null);
    const { deleteTargetRef, setDragState } = useDeleteDragOverlay();
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [location, setLocation] = useState('');
    const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null);
    // 可见性：默认公开。allowed/denied 为"只给谁看/不给谁看"的 userId 列表，
    // 当前仅维护在客户端（入口按钮），后端只存储主 visibility 字段。
    const [visibility, setVisibility] = useState<VisibilityOption>('public');
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [deniedUserIds, setDeniedUserIds] = useState<string[]>([]);
    const [visibilityPickerVisible, setVisibilityPickerVisible] = useState(false);
    // 已插入到正文的话题集合。点击话题追加到正文后，从选择列表中移除
    const [usedTopics, setUsedTopics] = useState<string[]>([]);
    // 维护正文 TextInput 的光标选区，用于把话题插入到当前光标处
    const [contentSelection, setContentSelection] = useState<{ start: number; end: number }>({
        start: 0,
        end: 0,
    });
    // 正文是否真正处于聚焦状态：只有聚焦时才把 selection 受控传给 TextInput，
    // 否则持续受控的 selection 会在进入/切回本页时强制吸附焦点并弹键盘。
    const [contentFocused, setContentFocused] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [editorVisible, setEditorVisible] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [imageSheetVisible, setImageSheetVisible] = useState(false);
    const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
    // 编辑器当前这次打开是否来自 AlbumPicker（决定滑入完成后是否关闭相册）
    const [editorInAlbum, setEditorInAlbum] = useState(false);
    // 左上角返回按钮触发的"保留/不保留"确认 sheet
    const [backSheetVisible, setBackSheetVisible] = useState(false);
    // 位置选择弹窗（全屏，带搜索与附近列表）
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);

    useFocusEffect(useCallback(() => {
        return () => setDragState(DELETE_DRAG_IDLE_STATE);
    }, [setDragState]));

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(DRAFT_KEY);
                if (raw) {
                    const draft = JSON.parse(raw);
                    if (draft.title) setTitle(draft.title);
                    if (draft.content) setContent(draft.content);
                    if (draft.selectedTopic) setSelectedTopic(draft.selectedTopic);
                    if (draft.location) setLocation(draft.location);
                    if (draft.locationDetail) setLocationDetail(draft.locationDetail);
                    if (draft.selectedImages) setSelectedImages(draft.selectedImages);
                    if (
                        draft.visibility === 'public' ||
                        draft.visibility === 'mutual' ||
                        draft.visibility === 'private'
                    ) {
                        setVisibility(draft.visibility);
                    }
                    if (Array.isArray(draft.allowedUserIds)) setAllowedUserIds(draft.allowedUserIds);
                    if (Array.isArray(draft.deniedUserIds)) setDeniedUserIds(draft.deniedUserIds);
                    if (Array.isArray(draft.usedTopics)) setUsedTopics(draft.usedTopics);
                }
            } catch {} finally { setDraftLoaded(true); }
        })();
    }, []);

    // 接收 Tab 入口选图并编辑完成后带回的图片，追加到已有图片后。
    // 注意：不要在这里调用 router.setParams({ newImages: undefined })。
    // expo-router 的 setParams 会触发 Stack 再次派发导航动作，和本页 <Stack.Screen options={{...}}>
    // 的内联 options（每次 render 都是新对象）叠加后，会让 navigation.setOptions 反复触发，
    // 最终引发 "Maximum update depth exceeded"。幂等由 handledNewImagesRef 保障即可。
    useEffect(() => {
        if (!draftLoaded) return;
        const raw = params.newImages;
        if (!raw || typeof raw !== 'string') return;
        if (handledNewImagesRef.current === raw) return;
        handledNewImagesRef.current = raw;
        try {
            const uris = JSON.parse(raw) as string[];
            if (!Array.isArray(uris) || uris.length === 0) return;
            setSelectedImages((prev) => [...prev, ...uris].slice(0, 9));
        } catch {}
    }, [draftLoaded, params.newImages]);

    const saveDraftToStorage = useCallback(async () => {
        try {
            const draft = {
                title,
                content,
                selectedTopic,
                location,
                locationDetail,
                selectedImages,
                visibility,
                allowedUserIds,
                deniedUserIds,
                usedTopics,
            };
            const hasContent = title || content || selectedTopic || location || selectedImages.length > 0;
            if (hasContent) {
                await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            }
        } catch {}
    }, [
        title,
        content,
        selectedTopic,
        location,
        locationDetail,
        selectedImages,
        visibility,
        allowedUserIds,
        deniedUserIds,
        usedTopics,
    ]);

    const clearDraft = async () => {
        try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
    };

    const topics = [
        '摩托车改装', '骑行装备', '机车摄影', '赛道日',
        '摩旅日记', '机车保养', '新车评测', '二手交易', '骑行技巧'
    ];

    const remainingSlots = 9 - selectedImages.length;

    const pickImage = () => {
        if (remainingSlots <= 0) {
            Alert.alert('提示', '最多只能选择9张图片');
            return;
        }
        setImageSheetVisible(true);
    };

    const handleChooseFromAlbum = () => {
        setImageSheetVisible(false);
        setTimeout(() => setAlbumPickerVisible(true), 220);
    };

    const handleAlbumConfirm = (uris: string[]) => {
        if (uris.length === 0) return;
        const startIndex = selectedImages.length;
        const merged = [...selectedImages, ...uris].slice(0, 9);
        setSelectedImages(merged);
        setEditingIndex(startIndex);
        setEditorInAlbum(true);
        setEditorVisible(true);
    };

    const handleEditorOpened = () => {
        if (editorInAlbum) {
            // 编辑器滑入完成，再关闭底下的相册页面
            setAlbumPickerVisible(false);
        }
    };

    const handleEditorClosed = () => {
        setEditingIndex(null);
        setEditorInAlbum(false);
    };

    const handleDeleteImage = useCallback((index: number) => {
        setDragState({ dragging: false, overDelete: false });
        setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    }, [setDragState]);

    const handleReorderImages = useCallback((from: number, to: number) => {
        if (from === to) return;
        setSelectedImages((prev) => {
            const next = [...prev];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        });
    }, []);

    // 稳定的拖拽状态回调，避免内联函数在每次 render 都变成新引用，
    // 进而触发子组件 useEffect 反复调用 setDragState 引起无限循环。
    const handleDragStateChange = useCallback(
        (state: { dragging: boolean; overDelete: boolean }) => setDragState(state),
        [setDragState]
    );

    // 点击话题：把 "#话题 " 追加到正文当前光标处，并把光标移动到插入文本之后。
    // 同时把最后一次点击的话题记录为主话题（selectedTopic），继续上报给服务端。
    // 插入后的话题会加入 usedTopics，从话题选择列表中移除，避免重复插入。
    const handleTopicPress = useCallback(
        (topic: string) => {
            const tag = `#${topic} `;
            setContent((prev) => {
                const start = Math.min(Math.max(contentSelection.start, 0), prev.length);
                const end = Math.min(Math.max(contentSelection.end, start), prev.length);
                const next = prev.slice(0, start) + tag + prev.slice(end);
                // 插入后把光标挪到新内容末尾（下一轮 onSelectionChange 会覆盖为真实值）。
                const caret = start + tag.length;
                setContentSelection({ start: caret, end: caret });
                return next;
            });
            setSelectedTopic(topic);
            setUsedTopics((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
        },
        [contentSelection]
    );

    // 过滤掉已插入到正文的话题，避免用户重复添加
    const availableTopics = useMemo(
        () => topics.filter((t) => !usedTopics.includes(t)),
        [usedTopics]
    );

    const handleOpenVisibilityPicker = useCallback(() => {
        setVisibilityPickerVisible(true);
    }, []);

    const handleOpenAllowedUsers = useCallback(() => {
        Alert.alert('提示', '选择"只给谁看"的功能即将上线');
    }, []);

    const handleOpenDeniedUsers = useCallback(() => {
        Alert.alert('提示', '选择"不给谁看"的功能即将上线');
    }, []);

    const openEditor = (index: number) => {
        setEditorInAlbum(false);
        setEditingIndex(index);
        setEditorVisible(true);
    };

    const closeEditor = () => {
        setEditorVisible(false);
    };

    const handleEditorDone = (newImages: string[]) => {
        setSelectedImages(newImages);
        setEditorVisible(false);
    };

    // 点击"位置"：打开全屏位置选择窗口（定位/搜索/附近列表均在内部处理）
    const handleOpenLocationPicker = () => {
        setLocationPickerVisible(true);
    };

    const handleLocationPicked = (
        label: string | null,
        detail: LocationDetail | null,
    ) => {
        setLocationPickerVisible(false);
        if (!label || !detail) {
            setLocation('');
            setLocationDetail(null);
            return;
        }
        setLocationDetail(detail);
        setLocation(label);
    };

    // 发布：构造 FormData 后交给全局 PublishTaskProvider 异步上传，
    // 立即清理发布页本地状态并关闭页面。进度条/完成飘字由 Provider 层负责。
    const handlePublish = async () => {
        if (globalPublishing) {
            Alert.alert('提示', '上一条内容正在发布中，请稍候');
            return;
        }
        if (!title.trim()) {
            Alert.alert('提示', '请输入标题');
            return;
        }
        if (!content.trim()) {
            Alert.alert('提示', '请输入内容');
            return;
        }
        if (selectedImages.length === 0) {
            Alert.alert('提示', '请至少选择一张图片');
            return;
        }

        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('content', content.trim());

        if (selectedTopic) {
            formData.append('topic', selectedTopic);
        }

        // 可见性：以数字字符串形式上报（0-公开 / 1-仅互关 / 2-仅自己）
        formData.append('visibility', String(VISIBILITY_CODE[visibility]));

        if (locationDetail) {
            formData.append('location_province', locationDetail.province);
            formData.append('location_city', locationDetail.city);
            formData.append('location_district', locationDetail.district);
            formData.append('location_address', locationDetail.address);
            formData.append('location_latitude', String(locationDetail.latitude));
            formData.append('location_longitude', String(locationDetail.longitude));
        }

        for (let i = 0; i < selectedImages.length; i++) {
            const uri = selectedImages[i];
            const filename = uri.split('/').pop() || `image_${i}.jpg`;
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('images', {
                uri,
                name: filename,
                type,
            } as any);
        }

        // 交给后台任务。失败时 Provider 会自己弹飘字，这里不需要再处理。
        submitPublish({ formData });

        // 立即清理本地编辑态与草稿缓存，避免用户再回到发布页看到旧内容。
        await clearDraft();
        setSelectedImages([]);
        setTitle('');
        setContent('');
        setSelectedTopic('');
        setLocation('');
        setLocationDetail(null);
        setVisibility('public');
        setAllowedUserIds([]);
        setDeniedUserIds([]);
        setUsedTopics([]);
        handledNewImagesRef.current = null;

        router.back();
    };

    const handleSaveDraft = async () => {
        await saveDraftToStorage();
        Alert.alert('保存成功', '内容已保存为草稿');
        router.back();
    };

    // 判断当前发布页是否存在任何可保留的编辑内容（标题/正文/话题/位置/图片任一非空）。
    const hasEditContent = useMemo(
        () =>
            !!title ||
            !!content ||
            !!selectedTopic ||
            !!location ||
            selectedImages.length > 0,
        [title, content, selectedTopic, location, selectedImages.length]
    );

    // 清空发布页所有编辑态，使下次打开回到"空白新发布"。
    const resetEditState = useCallback(() => {
        setTitle('');
        setContent('');
        setSelectedTopic('');
        setLocation('');
        setLocationDetail(null);
        setSelectedImages([]);
        setVisibility('public');
        setAllowedUserIds([]);
        setDeniedUserIds([]);
        setUsedTopics([]);
    }, []);

    const handleBackPress = useCallback(() => {
        if (!hasEditContent) {
            // 没有任何编辑内容时直接返回，不打扰用户。
            router.back();
            return;
        }
        setBackSheetVisible(true);
    }, [hasEditContent, router]);

    // "保留"：把当前编辑保存为草稿，再关闭发布页。下次打开会自动恢复。
    const handleBackKeepDraft = useCallback(async () => {
        setBackSheetVisible(false);
        await saveDraftToStorage();
        router.back();
    }, [saveDraftToStorage, router]);

    // "不保留"：清空草稿缓存与当前编辑态，再关闭发布页。
    const handleBackDiscard = useCallback(async () => {
        setBackSheetVisible(false);
        await clearDraft();
        resetEditState();
        // 同时重置"已处理过的 newImages"标记，避免下次 params 相同时被跳过。
        handledNewImagesRef.current = null;
        router.back();
    }, [resetEditState, router]);

    // 注：原本使用 <Stack.Screen options={{ headerLeft }} /> 注册左上角返回按钮，
    // 但 app/_layout.tsx 对 (tabs) 设置了 headerShown: false，且 (tabs)/_layout.tsx 内部
    // 也关闭了 header，所以 Stack 的 headerLeft 根本不会被渲染。这里改为在页面顶部
    // 自绘一个 header 条，放置"返回"按钮。

    return (
        <View style={CommonStyles.containerWhite}>
            <SafeAreaView style={CommonStyles.safeAreaWhite}>
                {/* 自定义顶部栏：左箭头返回 + 右侧占位对称 */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={handleBackPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.headerBackBtn}
                    >
                        <Ionicons name="chevron-back" size={26} color="#000" />
                    </TouchableOpacity>
                    <View style={styles.headerRightPlaceholder} />
                </View>

                <ScrollView style={CommonStyles.scrollView}>
                    {/* 图片选择区域 */}
                    <View style={styles.imageSection}>
                        {selectedImages.length > 0 ? (
                            <DraggableThumbList
                                images={selectedImages}
                                currentIndex={editingIndex ?? -1}
                                onSelect={openEditor}
                                onReorder={handleReorderImages}
                                onDelete={handleDeleteImage}
                                deleteTargetRef={deleteTargetRef}
                                onDragStateChange={handleDragStateChange}
                                variant="light"
                                thumbSize={80}
                                thumbGap={10}
                                hintText={null}
                                trailingContent={
                                    selectedImages.length < 9 ? (
                                        <TouchableOpacity
                                            style={[styles.addButton, styles.addButtonInline]}
                                            onPress={pickImage}
                                        >
                                            <Ionicons name="add" size={30} color="#999" />
                                            <Text style={styles.addButtonText}>
                                                {selectedImages.length}/9
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null
                                }
                            />
                        ) : (
                            <TouchableOpacity style={styles.addButton} onPress={pickImage}>
                                <Ionicons name="add" size={30} color="#999" />
                                <Text style={styles.addButtonText}>
                                    {selectedImages.length}/9
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* 标题输入 */}
                    <View style={styles.inputSection}>
                        <TextInput
                            style={styles.titleInput}
                            placeholder="添加标题"
                            value={title}
                            onChangeText={setTitle}
                            maxLength={50}
                        />
                    </View>

                    {/* 正文输入 */}
                    <View style={styles.inputSection}>
                        <TextInput
                            style={styles.contentInput}
                            placeholder="添加正文"
                            value={content}
                            onChangeText={setContent}
                            multiline
                            numberOfLines={5}
                            maxLength={2000}
                            selection={contentFocused ? contentSelection : undefined}
                            onFocus={() => setContentFocused(true)}
                            onBlur={() => setContentFocused(false)}
                            onSelectionChange={(e) =>
                                setContentSelection(e.nativeEvent.selection)
                            }
                        />
                        <Text style={styles.charCount}>{content.length}/2000</Text>
                    </View>

                    {/* 话题选择：点击话题会把 #xxx 追加到正文当前光标处，
                        已插入的话题会从列表移除；全部用完时整块隐藏 */}
                    {availableTopics.length > 0 ? (
                        <View style={[styles.section, CommonStyles.borderBottom]}>
                            <Text style={styles.sectionTitle}>选择话题</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicScroll}>
                                {availableTopics.map((topic) => (
                                    <TouchableOpacity
                                        key={topic}
                                        style={[
                                            styles.topicButton,
                                            selectedTopic === topic && styles.selectedTopicButton,
                                        ]}
                                        onPress={() => handleTopicPress(topic)}
                                    >
                                        <Text
                                            style={[
                                                styles.topicText,
                                                selectedTopic === topic && styles.selectedTopicText,
                                            ]}
                                        >
                                            #{topic}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    ) : null}

                    {/* 位置选择 */}
                    <TouchableOpacity
                        style={styles.locationSection}
                        onPress={handleOpenLocationPicker}
                    >
                        <Ionicons
                            name="location-outline"
                            size={20}
                            color={location ? Colors.primary : Colors.textSecondary}
                        />
                        <Text
                            style={[
                                styles.locationText,
                                location && styles.locationTextActive,
                            ]}
                        >
                            {location || '所在位置'}
                        </Text>
                        {location ? (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setLocation('');
                                    setLocationDetail(null);
                                }}
                                style={styles.locationClear}
                            >
                                <Ionicons
                                    name="close-circle"
                                    size={16}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>
                        ) : null}
                    </TouchableOpacity>

                    {/* 可见性选择：默认"公开可见"，点击后底部弹出 Modal 选择具体可见范围 */}
                    <TouchableOpacity
                        style={styles.locationSection}
                        onPress={handleOpenVisibilityPicker}
                    >
                        <Ionicons
                            name={
                                visibility === 'public'
                                    ? 'lock-open-outline'
                                    : visibility === 'mutual'
                                        ? 'people-outline'
                                        : 'lock-closed-outline'
                            }
                            size={20}
                            color={Colors.textSecondary}
                        />
                        <Text
                            style={[styles.locationText, styles.locationTextActive]}
                        >
                            {VISIBILITY_LABELS[visibility]}
                        </Text>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={Colors.textTertiary}
                        />
                    </TouchableOpacity>
                </ScrollView>

                {/* 底部按钮 */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.draftButton}
                        onPress={handleSaveDraft}
                        disabled={globalPublishing}
                    >
                        <FontAwesome name="bookmark-o" size={16} color="#666" />
                        <Text style={styles.draftText}>存草稿</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.publishButton,
                            globalPublishing && styles.publishButtonDisabled,
                        ]}
                        onPress={handlePublish}
                        disabled={globalPublishing}
                    >
                        {globalPublishing ? (
                            <BouncingDotsIndicator mode="inline" size={16} color={Colors.white} />
                        ) : (
                            <Text style={styles.publishText}>发布</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
            <ActionSheet
                visible={imageSheetVisible}
                onClose={() => setImageSheetVisible(false)}
                options={[
                    {
                        label: '从手机相册选择',
                        onPress: handleChooseFromAlbum,
                    },
                ]}
            />

            <ActionSheet
                visible={backSheetVisible}
                onClose={() => setBackSheetVisible(false)}
                title="是否保留本次编辑？"
                cancelText="继续编辑"
                options={[
                    {
                        label: '保留',
                        onPress: handleBackKeepDraft,
                    },
                    {
                        label: '不保留',
                        destructive: true,
                        onPress: handleBackDiscard,
                    },
                ]}
            />

            <LocationPicker
                visible={locationPickerVisible}
                onClose={() => setLocationPickerVisible(false)}
                onConfirm={handleLocationPicked}
            />

            <VisibilityPicker
                visible={visibilityPickerVisible}
                value={visibility}
                allowedCount={allowedUserIds.length}
                deniedCount={deniedUserIds.length}
                onClose={() => setVisibilityPickerVisible(false)}
                onChange={(next) => setVisibility(next)}
                onOpenAllowed={handleOpenAllowedUsers}
                onOpenDenied={handleOpenDeniedUsers}
            />

            <AlbumPicker
                visible={albumPickerVisible}
                maxCount={remainingSlots > 0 ? remainingSlots : 9}
                onCancel={() => setAlbumPickerVisible(false)}
                onConfirm={handleAlbumConfirm}
            />

            {editingIndex !== null && selectedImages.length > 0 ? (
                <ImageEditor
                    visible={editorVisible}
                    images={selectedImages}
                    initialIndex={editingIndex}
                    onCancel={closeEditor}
                    onDone={handleEditorDone}
                    onOpened={handleEditorOpened}
                    onClosed={handleEditorClosed}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        paddingHorizontal: Spacing.sm,
    },
    headerBackBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRightPlaceholder: {
        width: 40,
        height: 40,
    },
    section: {
        padding: Spacing.lg,
    },
    imageSection: {
        padding: Spacing.lg,
        ...CommonStyles.borderBottom,
    },
    sectionTitle: {
        ...CommonStyles.textSectionTitle,
        marginBottom: Spacing.md,
    },
    addButton: {
        width: 80,
        height: 80,
        borderRadius: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.borderDark,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundLightGray,
    },
    addButtonInline: {
        marginLeft: 2,
    },
    addButtonText: {
        fontSize: 10,
        color: '#999',
        marginTop: 2,
    },
    inputSection: {
        padding: Spacing.lg,
        ...CommonStyles.borderBottom,
    },
    titleInput: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        padding: 0,
    },
    contentInput: {
        fontSize: FontSize.md,
        padding: 0,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        textAlign: 'right',
        color: Colors.textSecondary,
        fontSize: FontSize.xs,
        marginTop: Spacing.sm,
    },
    topicScroll: {
        marginHorizontal: -4,
    },
    topicButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm - 2,
        borderRadius: 16,
        backgroundColor: Colors.backgroundGray,
        marginRight: Spacing.sm,
    },
    selectedTopicButton: {
        backgroundColor: Colors.primary,
    },
    topicText: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
    },
    selectedTopicText: {
        color: Colors.white,
    },
    locationSection: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        ...CommonStyles.borderBottom,
    },
    locationText: {
        marginLeft: Spacing.sm,
        color: Colors.textSecondary,
        flex: 1,
    },
    locationTextActive: {
        color: Colors.textPrimary,
    },
    locationClear: {
        padding: 4,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        // 上下 padding 压缩，使发布按钮区域整体高度累计减少 20（同步更新 DeleteDragOverlay 中的 PUBLISH_FOOTER_HEIGHT）
        // 同时通过增加顶部 padding、减少底部 padding，让"存草稿/发布"按钮整体向下偏移 5（总高度保持不变）
        paddingTop: Spacing.lg - 10 + 5,
        paddingBottom: Spacing.lg - 10 - 5,
        ...CommonStyles.borderTop,
        backgroundColor: Colors.backgroundWhite,
    },
    draftButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm + 2,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.borderDark,
        marginRight: Spacing.md,
    },
    draftText: {
        marginLeft: Spacing.sm - 2,
        color: Colors.textSecondary,
    },
    publishButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: 20,
        alignItems: 'center',
    },
    publishButtonDisabled: {
        opacity: 0.6,
    },
    publishText: {
        color: Colors.white,
        fontWeight: '600',
    },
});
