import { Stack } from 'expo-router';
import { LogBox, StatusBar } from 'react-native';

LogBox.ignoreAllLogs(false)

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
