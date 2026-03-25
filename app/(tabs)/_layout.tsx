/*
 * @Descripttion: 
 * @Author: kkfeng@tencent.com
 * @version: 1.0
 * @Date: 2025-04-16 08:53:42
 * @LastEditors: kkfeng@tencent.com
 */
import { Tabs } from 'expo-router';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../config/auth';

export default function TabLayout() {
    const router = useRouter();
    const { isLoggedIn } = useAuth();

    const authGuardListener = {
        tabPress: (e: any) => {
            if (!isLoggedIn) {
                e.preventDefault();
                router.push('/login');
            }
        },
    };

    return (
        <View style={{ flex: 1 }}>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: '#000',
                    headerShown: false,
                    headerTintColor: 'black',
                    tabBarStyle: {
                        backgroundColor: '#f8f9fa',
                        height: 60,
                        paddingBottom: 5,
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
                        tabBarButton: () => (
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    paddingTop: 5,
                                }}
                            >
                                <TouchableOpacity
                                    style={{
                                        width: 50,
                                        height: 50,
                                        borderRadius: 25,
                                        backgroundColor: '#ff2442',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginBottom: 5,
                                    }}
                                    onPress={() => {
                                        if (!isLoggedIn) { router.push('/login'); return; }
                                        router.push('/publish');
                                    }}
                                >
                                    <Ionicons name="add" size={24} color="#fff" />
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
                    }}
                    listeners={authGuardListener}
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
        </View>
    );
}