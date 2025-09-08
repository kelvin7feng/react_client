/*
 * @Descripttion: 
 * @Author: kkfeng@tencent.com
 * @version: 1.0
 * @Date: 2025-04-16 08:53:42
 * @LastEditors: kkfeng@tencent.com
 */
import { Tabs } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#black',
                headerShown: false,
                headerTintColor: 'black',
                tabBarStyle: {
                    backgroundColor: '#f8f9fa',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
                    ),
                }}
            />
            <Tabs.Screen
                name="selection"
                options={{
                    title: 'Selection',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons name="motorbike" color={color} size={24} />
                    ),
                }}
            />
            <Tabs.Screen
                name="my"
                options={{
                    title: 'My',
                    tabBarIcon: ({ color, focused }) => (
                        <AntDesign name="user" size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
