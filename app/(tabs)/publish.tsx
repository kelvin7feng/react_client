import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Platform,
    StatusBar,
    Image,
    StyleSheet,
    FlatList,
    Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
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

                <ScrollView style={styles.scrollView}>
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
                    <View style={styles.divider} />

                    {/* 位置选择 */}
                    <TouchableOpacity style={styles.locationSection}>
                        <Ionicons name="location-outline" size={20} color="#666" />
                        <Text style={styles.locationText}>
                            {location || '添加位置'}
                        </Text>
                    </TouchableOpacity>

                    {/* 分割线 */}
                    <View style={styles.divider} />
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
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        padding: 16,
    },
    imageSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
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
        borderRadius: 8,
    },
    removeButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
    },
    addButton: {
        width: 80,
        height: 80,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
    },
    inputSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    titleInput: {
        fontSize: 18,
        fontWeight: '600',
        padding: 0,
    },
    contentInput: {
        fontSize: 16,
        padding: 0,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    topicScroll: {
        marginHorizontal: -4,
    },
    topicButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
        marginRight: 8,
    },
    selectedTopicButton: {
        backgroundColor: '#ff2442',
    },
    topicText: {
        color: '#666',
        fontSize: 14,
    },
    selectedTopicText: {
        color: '#fff',
    },
    divider: {
        height: 8,
        backgroundColor: '#f0f0f0',
    },
    locationSection: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    locationText: {
        marginLeft: 8,
        color: '#666',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fff',
    },
    draftButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 12,
    },
    draftText: {
        marginLeft: 6,
        color: '#666',
    },
    publishButton: {
        flex: 1,
        backgroundColor: '#ff2442',
        paddingVertical: 12,
        borderRadius: 20,
        alignItems: 'center',
    },
    publishText: {
        color: '#fff',
        fontWeight: '600',
    },
});