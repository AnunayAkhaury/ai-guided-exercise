import { Stack } from 'expo-router';
import { ZoomVideoSdkProvider } from '@zoom/react-native-videosdk';

export default function RootLayout() {
  return (
    <ZoomVideoSdkProvider
      config={{
        domain: 'zoom.us',
        enableLog: true
      }}>
      <Stack screenOptions={{ headerShown: false }} />
    </ZoomVideoSdkProvider>
  );
}
