import { useState, useEffect } from 'react';
import {
    Text,
    View,
    StyleSheet,
    Image,
    ScrollView,
    SafeAreaView,
    Platform,
    StatusBar,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';

export default function MyScreen() {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 从API获取用户数据
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: 1000000 }));

                if (!response.ok) {
                    throw new Error(`HTTP错误! 状态: ${response.status}`);
                }

                const result = await response.json();

                // 检查API返回的code是否为0（成功）
                if (result.code !== 0) {
                    throw new Error(result.msg || '获取用户信息失败');
                }

                // 使用API返回的数据
                setUserData(result.data);
            } catch (err) {
                setError(err.message);
                Alert.alert('错误', '获取用户信息失败: ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    // 格式化日期函数
    const formatDate = (dateString) => {
        if (!dateString) return '未知';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    // 格式化性别函数
    const formatGender = (genderCode) => {
        switch (genderCode) {
            case 1: return '男';
            case 2: return '女';
            default: return '未知';
        }
    };

    // 加载状态显示
    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="gray" />
                    <Text style={styles.loadingText}>数据加载中</Text>
                </View>
            </SafeAreaView>
        );
    }

    // 错误状态显示
    if (error) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={50} color="#FF3B30" />
                    <Text style={styles.errorText}>加载失败</Text>
                    <Text style={styles.errorSubText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    // 如果没有用户数据
    if (!userData) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.errorContainer}>
                    <Ionicons name="person" size={50} color="#8E8E93" />
                    <Text style={styles.errorText}>未找到用户数据</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                {/* 用户头像和名字部分 */}
                <View style={styles.profileHeader}>
                    <Image
                        source={{ uri: userData.avatar || 'https://picsum.photos/200/200?random=1' }}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{userData.username || '未知用户'}</Text>
                    <Text style={styles.signature}>{userData.signature || '暂无个性签名'}</Text>
                </View>

                {/* 个人信息详情部分 */}
                <View style={styles.infoSection}>
                    <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="person" size={20} color="#666" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>性别</Text>
                            <Text style={styles.infoValue}>
                                {formatGender(userData.gender)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="calendar" size={20} color="#666" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>生日</Text>
                            <Text style={styles.infoValue}>
                                {formatDate(userData.birthday)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="mail" size={20} color="#666" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>邮箱</Text>
                            <Text style={styles.infoValue}>{userData.email || '未设置'}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
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
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#8E8E93',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        marginTop: 10,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF3B30',
    },
    errorSubText: {
        marginTop: 5,
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        marginTop: Platform.OS === 'ios' ? 10 : 0,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    signature: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    infoSection: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoIcon: {
        width: 40,
        alignItems: 'center',
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        color: '#999',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: '#333',
    },
});