import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
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
import { checkForAppUpdate } from './src/lib/appUpdater';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppRoot({ onReadyToHideSplash }: { onReadyToHideSplash: () => void }) {
  const {
    ready,
    isDark,
    lockedByPin,
    availableUpdate,
    setAvailableUpdate,
    updateModalOpen,
    openUpdateModal,
    closeUpdateModal,
  } = useAttendance();

  useEffect(() => {
    if (ready) {
      onReadyToHideSplash();
    }
  }, [ready, onReadyToHideSplash]);

  useEffect(() => {
    let active = true;
    const runUpdateCheck = () => {
      void checkForAppUpdate().then((info) => {
        if (!active || !info) return;
        setAvailableUpdate(info);
        if (!info.isDismissed) {
          openUpdateModal();
        }
      });
    };

    const timer = setTimeout(runUpdateCheck, 1500);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runUpdateCheck();
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [setAvailableUpdate, openUpdateModal]);

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
        updateInfo={updateModalOpen ? availableUpdate : null}
        onClose={closeUpdateModal}
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
