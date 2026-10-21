import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
// Define a tarefa de sincronização em segundo plano antes de qualquer tela
import './src/services/background';
import { widgetTaskHandler } from './src/widget/handler';
import App from './App';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
