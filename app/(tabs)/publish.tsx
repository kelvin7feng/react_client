import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Image,
    StyleSheet,
    FlatList,
    Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';

export default function PublishScreen() {
    const router = useRouter();
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [location, setLocation] = useState('');

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
            quality: 1,
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

    const handlePublish = () => {
        // 这里处理发布逻辑
        Alert.alert('发布成功', '您的内容已成功发布');
        router.back();
    };

    const handleSaveDraft = () => {
        // 这里处理保存草稿逻辑
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
                        />
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
                                    onPress={() => setSelectedTopic(topic)}
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
                    <TouchableOpacity style={styles.locationSection}>
                        <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
                        <Text style={styles.locationText}>
                            {location || '添加位置'}
                        </Text>
                    </TouchableOpacity>

                    {/* 分割线 */}
                    <View style={CommonStyles.divider} />
                </ScrollView>

                {/* 底部按钮 */}
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
                        <FontAwesome name="bookmark-o" size={16} color="#666" />
                        <Text style={styles.draftText}>存草稿</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.publishButton} onPress={handlePublish}>
                        <Text style={styles.publishText}>发布</Text>
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
    publishText: {
        color: Colors.white,
        fontWeight: '600',
    },
});