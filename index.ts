import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';
// Defines the background sync task; must be at module scope
import './src/features/sync/background';

registerWidgetTaskHandler(widgetTaskHandler);
