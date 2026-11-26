import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { AttendanceProvider, useAttendance } from './src/context/AttendanceContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AnimatedSplashOverlay } from './src/components/AnimatedSplashOverlay';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PinLockScreen } from './src/components/PinLockScreen';
import { RecordEditorSheet } from './src/components/RecordEditorSheet';
import { UpdateModal } from './src/components/UpdateModal';
import { checkForAppUpdate, type UpdateInfo } from './src/lib/appUpdater';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppRoot({ onReadyToHideSplash }: { onReadyToHideSplash: () => void }) {
  const { ready, isDark, lockedByPin } = useAttendance();
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (ready) {
      onReadyToHideSplash();
    }
  }, [ready, onReadyToHideSplash]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void checkForAppUpdate().then((info) => {
        if (active && info) {
          setPendingUpdate(info);
        }
      });
    }, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {lockedByPin ? (
        <PinLockScreen />
      ) : (
        <BottomSheetModalProvider>
          <AppNavigator />
          <RecordEditorSheet />
        </BottomSheetModalProvider>
      )}
      <UpdateModal
        updateInfo={pendingUpdate}
        onClose={() => setPendingUpdate(null)}
      />
      <AnimatedSplashOverlay />
    </>
  );
}

export default function App() {
  useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const splashHiddenRef = useRef(false);

  const hideSplashOnce = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const failSafeTimer = setTimeout(() => {
      hideSplashOnce();
    }, 1200);
    return () => clearTimeout(failSafeTimer);
  }, [hideSplashOnce]);

  return (
    <View style={{ flex: 1, backgroundColor: '#050608' }} onLayout={hideSplashOnce}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <AttendanceProvider>
              <AppRoot onReadyToHideSplash={hideSplashOnce} />
            </AttendanceProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </View>
  );
}
