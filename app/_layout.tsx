/*
 * @Descripttion: 
 * @Author: kkfeng@tencent.com
 * @version: 1.0
 * @Date: 2025-12-26 22:33:43
 * @LastEditors: kkfeng@tencent.com
 */
import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../config/auth';

LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#f8f9fa' },
            headerTintColor: '#333',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="brand/[brandId]" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle/[vehicleId]" options={{ headerShown: false }} />
          <Stack.Screen name="price-vehicles" options={{ headerShown: false }} />
          <Stack.Screen name="article/[articleId]" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
          <Stack.Screen name="follow-list" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="switch-account" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[conversationId]" options={{ headerShown: false }} />
          <Stack.Screen name="user/[userId]" options={{ headerShown: false }} />
          <Stack.Screen name="scanner" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
