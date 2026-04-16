import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Image,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { publishArticle } from '@/features/community/api';
import { CommonStyles, Colors, Spacing, FontSize } from '../../config/styles';
import { useAuth } from '../../config/auth';

const DRAFT_KEY = 'publish_draft';

export default function PublishScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [location, setLocation] = useState('');
    const [locationDetail, setLocationDetail] = useState<{
        province: string;
        city: string;
        district: string;
        address: string;
        latitude: number;
        longitude: number;
    } | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);

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
                }
            } catch {} finally { setDraftLoaded(true); }
        })();
    }, []);

    const saveDraftToStorage = useCallback(async () => {
        try {
            const draft = { title, content, selectedTopic, location, locationDetail, selectedImages };
            const hasContent = title || content || selectedTopic || location || selectedImages.length > 0;
            if (hasContent) {
                await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            }
        } catch {}
    }, [title, content, selectedTopic, location, locationDetail, selectedImages]);

    const clearDraft = async () => {
        try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
    };

    const topics = [
        '摩托车改装', '骑行装备', '机车摄影', '赛道日',
        '摩旅日记', '机车保养', '新车评测', '二手交易', '骑行技巧'
    ];

    const pickImage = async () => {
        if (selectedImages.length >= 9) {
            Alert.alert('提示', '最多只能选择9张图片');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImages([...selectedImages, result.assets[0].uri]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...selectedImages];
        newImages.splice(index, 1);
        setSelectedImages(newImages);
    };

    const handleGetLocation = async () => {
        setIsLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('提示', '需要位置权限才能添加定位');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({});
            const [geocode] = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });

            if (geocode) {
                const detail = {
                    province: geocode.region || '',
                    city: geocode.city || '',
                    district: geocode.district || '',
                    address: geocode.name || geocode.street || '',
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
                setLocationDetail(detail);
                const displayLocation = [detail.city, detail.district].filter(Boolean).join(' ');
                setLocation(displayLocation || '未知位置');
            }
        } catch (error) {
            Alert.alert('定位失败', '无法获取当前位置，请稍后重试');
        } finally {
            setIsLocating(false);
        }
    };

    const handlePublish = async () => {
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

        setIsPublishing(true);

        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('content', content.trim());

            if (selectedTopic) {
                formData.append('topic', selectedTopic);
            }

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

            await publishArticle(formData);
            setSelectedImages([]);
            setTitle('');
            setContent('');
            setSelectedTopic('');
            setLocation('');
            setLocationDetail(null);
            await clearDraft();
            Alert.alert('发布成功', '您的内容已成功发布', [
                { text: '确定', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert('发布失败', error instanceof Error ? error.message : '网络错误，请检查网络连接后重试');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleSaveDraft = async () => {
        await saveDraftToStorage();
        Alert.alert('保存成功', '内容已保存为草稿');
        router.back();
    };

    return (
        <View style={CommonStyles.containerWhite}>
            <SafeAreaView style={CommonStyles.safeAreaWhite}>
                <Stack.Screen
                    options={{
                        title: '',
                        headerLeft: () => (
                            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        ),
                    }}
                />

                <ScrollView style={CommonStyles.scrollView}>
                    {/* 图片选择区域 */}
                    <View style={styles.imageSection}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.imageList}>
                                {selectedImages.map((uri, index) => (
                                    <View key={index} style={styles.imageWrapper}>
                                        <Image source={{ uri }} style={styles.image} />
                                        <TouchableOpacity
                                            style={styles.removeButton}
                                            onPress={() => removeImage(index)}
                                        >
                                            <Ionicons name="close-circle" size={20} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {selectedImages.length < 9 && (
                                    <TouchableOpacity style={styles.addButton} onPress={pickImage}>
                                        <Ionicons name="add" size={30} color="#999" />
                                        <Text style={styles.addButtonText}>
                                            {selectedImages.length}/9
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>
                    </View>

                    {/* 标题输入 */}
                    <View style={styles.inputSection}>
                        <TextInput
                            style={styles.titleInput}
                            placeholder="请输入标题"
                            value={title}
                            onChangeText={setTitle}
                            maxLength={50}
                        />
                    </View>

                    {/* 正文输入 */}
                    <View style={styles.inputSection}>
                        <TextInput
                            style={styles.contentInput}
                            placeholder="分享你的故事..."
                            value={content}
                            onChangeText={setContent}
                            multiline
                            numberOfLines={5}
                            maxLength={2000}
                        />
                        <Text style={styles.charCount}>{content.length}/2000</Text>
                    </View>

                    {/* 话题选择 */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>选择话题</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicScroll}>
                            {topics.map((topic, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.topicButton,
                                        selectedTopic === topic && styles.selectedTopicButton
                                    ]}
                                    onPress={() => setSelectedTopic(
                                        selectedTopic === topic ? '' : topic
                                    )}
                                >
                                    <Text style={[
                                        styles.topicText,
                                        selectedTopic === topic && styles.selectedTopicText
                                    ]}>
                                        #{topic}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* 分割线 */}
                    <View style={CommonStyles.divider} />

                    {/* 位置选择 */}
                    <TouchableOpacity style={styles.locationSection} onPress={handleGetLocation}>
                        {isLocating ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Ionicons name="location-outline" size={20} color={location ? Colors.primary : Colors.textSecondary} />
                        )}
                        <Text style={[styles.locationText, location && styles.locationTextActive]}>
                            {isLocating ? '定位中...' : (location || '添加位置')}
                        </Text>
                        {location && !isLocating && (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setLocation('');
                                    setLocationDetail(null);
                                }}
                                style={styles.locationClear}
                            >
                                <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    {/* 分割线 */}
                    <View style={CommonStyles.divider} />
                </ScrollView>

                {/* 底部按钮 */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.draftButton}
                        onPress={handleSaveDraft}
                        disabled={isPublishing}
                    >
                        <FontAwesome name="bookmark-o" size={16} color="#666" />
                        <Text style={styles.draftText}>存草稿</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.publishButton, isPublishing && styles.publishButtonDisabled]}
                        onPress={handlePublish}
                        disabled={isPublishing}
                    >
                        {isPublishing ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                            <Text style={styles.publishText}>发布</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
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
    imageList: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    imageWrapper: {
        position: 'relative',
        marginRight: 10,
    },
    image: {
        width: 80,
        height: 80,
        borderRadius: Spacing.sm,
    },
    removeButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: Colors.overlay,
        borderRadius: 10,
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
        padding: Spacing.lg,
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
