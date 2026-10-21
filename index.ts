import { registerRootComponent } from 'expo';
// Define a tarefa de sincronização em segundo plano antes de qualquer tela
import './src/services/background';
import App from './App';

registerRootComponent(App);
