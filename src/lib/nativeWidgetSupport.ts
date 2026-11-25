import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Returns true only when running on Android outside Expo Go and when the
 * native `react-native-android-widget` module is actually linked in the binary.
 */
export function isNativeWidgetSupported(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }

  const turboModule =
    TurboModuleRegistry.get('AndroidWidget') ??
    TurboModuleRegistry.get('RNAndroidWidget');

  const legacyModule =
    NativeModules.AndroidWidget ?? NativeModules.RNAndroidWidget;

  return Boolean(turboModule ?? legacyModule);
}
