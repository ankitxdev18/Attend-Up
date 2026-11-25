import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';
import { isNativeWidgetSupported } from './src/lib/nativeWidgetSupport';

registerRootComponent(App);

if (isNativeWidgetSupported()) {
  // Lazy-require so Expo Go never evaluates TurboModuleRegistry.getEnforcing('AndroidWidget').
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
