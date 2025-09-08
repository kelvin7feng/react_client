import { Text, View, StyleSheet, Image, ScrollView, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MyScreen() {
    // 模拟用户数据
    const userData = {
        name: '张三',
        avatar: 'https://picsum.photos/200/200?random=1',
        bio: '热爱生活，喜欢旅行和摄影，记录美好瞬间',
        gender: '男',
        birthday: '1990-05-15',
        email: 'zhangsan@example.com'
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                {/* 用户头像和名字部分 */}
                <View style={styles.profileHeader}>
                    <Image
                        source={{ uri: userData.avatar }}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{userData.name}</Text>
                    <Text style={styles.bio}>{userData.bio}</Text>
                </View>

                {/* 个人信息详情部分 */}
                <View style={styles.infoSection}>
                    <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="person" size={20} color="#666" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>性别</Text>
                            <Text style={styles.infoValue}>{userData.gender}</Text>
                        </View>
                    </View>

                    <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="calendar" size={20} color="#666" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>生日</Text>
                            <Text style={styles.infoValue}>{userData.birthday}</Text>
                        </View>
                    </View>

                    <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="mail" size={20} color="#666" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>邮箱</Text>
                            <Text style={styles.infoValue}>{userData.email}</Text>
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
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        // 为刘海屏设备添加额外的顶部间距
        marginTop: Platform.OS === 'ios' ? 10 : 0,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50, // 圆形头像
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
    bio: {
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