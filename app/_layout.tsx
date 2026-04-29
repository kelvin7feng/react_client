/*
 * @Descripttion: 
 * @Author: kkfeng@tencent.com
 * @version: 1.0
 * @Date: 2025-12-26 22:33:43
 * @LastEditors: kkfeng@tencent.com
 */
import { Stack } from 'expo-router';
import { LogBox, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/client';
import { AuthProvider } from '../config/auth';
import ChatOverlay from '../components/ChatOverlay';
import GlobalToast from '../components/GlobalToast';

LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <View style={styles.root}>
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
            <Stack.Screen name="article/[articleId]" options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'none',
              gestureEnabled: false,
            }} />
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
          <ChatOverlay />
          <GlobalToast />
        </View>
      </AuthProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
