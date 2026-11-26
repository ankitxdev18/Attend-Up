import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';

import App from './App';
import { isNativeWidgetSupported } from './src/lib/nativeWidgetSupport';

// Ensure any uncaught JS error during startup dismisses the native splash
// instead of leaving the app frozen indefinitely on the splash screen.
const globalWithErrorUtils = globalThis as typeof globalThis & {
  ErrorUtils?: {
    getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
    setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  };
};

if (globalWithErrorUtils.ErrorUtils?.setGlobalHandler) {
  const previousHandler = globalWithErrorUtils.ErrorUtils.getGlobalHandler?.();
  globalWithErrorUtils.ErrorUtils.setGlobalHandler((error, isFatal) => {
    SplashScreen.hideAsync().catch(() => {});
    previousHandler?.(error, isFatal);
  });
}

registerRootComponent(App);

if (isNativeWidgetSupported()) {
  try {
    // Lazy-require so Expo Go never evaluates TurboModuleRegistry.getEnforcing('AndroidWidget').
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Ignore widget task handler registration errors so app startup never crashes.
  }
}
