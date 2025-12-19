import { useState, useEffect } from 'react';
import {
    Text,
    View,
    StyleSheet,
    Image,
    ScrollView,
    SafeAreaView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';
import { CommonStyles, Colors, Spacing, FontSize, Shadows } from '../../config/styles';

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
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.loadingContainer}>
                    <ActivityIndicator size="small" color="gray" />
                    <Text style={CommonStyles.loadingText}>数据加载中</Text>
                </View>
            </SafeAreaView>
        );
    }

    // 错误状态显示
    if (error) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.errorContainer}>
                    <Ionicons name="alert-circle" size={50} color={Colors.error} />
                    <Text style={CommonStyles.errorText}>加载失败</Text>
                    <Text style={CommonStyles.errorSubText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    // 如果没有用户数据
    if (!userData) {
        return (
            <SafeAreaView style={CommonStyles.safeArea}>
                <View style={CommonStyles.errorContainer}>
                    <Ionicons name="person" size={50} color={Colors.textDisabled} />
                    <Text style={CommonStyles.errorText}>未找到用户数据</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={CommonStyles.safeArea}>
            <ScrollView style={CommonStyles.container}>
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
    profileHeader: {
        alignItems: 'center',
        paddingVertical: Spacing.xxxl,
        paddingHorizontal: Spacing.xl,
        backgroundColor: Colors.backgroundWhite,
        marginBottom: Spacing.sm + 2,
        ...CommonStyles.borderBottom,
        marginTop: Platform.OS === 'ios' ? Spacing.sm + 2 : 0,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: Spacing.md + 3,
        borderWidth: 3,
        borderColor: Colors.white,
        ...Shadows.large,
    },
    name: {
        fontSize: FontSize.xxl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    signature: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    infoSection: {
        backgroundColor: Colors.backgroundWhite,
        paddingHorizontal: Spacing.md + 3,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.lg + 2,
        ...CommonStyles.borderBottom,
    },
    infoIcon: {
        width: 40,
        alignItems: 'center',
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginBottom: Spacing.xs,
    },
    infoValue: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
});