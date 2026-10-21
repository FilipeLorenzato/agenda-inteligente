// Fixa no package.json as versões das bibliotecas que combinam com o SDK do Expo instalado.
// Uso: npm install --legacy-peer-deps && node scripts/setup-deps.js && npm install
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const bundled = require(path.join(root, 'node_modules/expo/bundledNativeModules.json'));

const deps = [
  'react',
  'react-native',
  'expo-status-bar',
  'expo-system-ui',
  'expo-notifications',
  'expo-background-task',
  'expo-task-manager',
  '@react-native-async-storage/async-storage',
  '@react-native-community/datetimepicker',
  'react-native-safe-area-context',
];
// Bibliotecas fora do SDK: última versão publicada
const extra = { 'expo-speech-recognition': 'latest' };

for (const name of deps) {
  if (!bundled[name]) throw new Error(`O Expo não informa versão para ${name}`);
  pkg.dependencies[name] = bundled[name];
}
Object.assign(pkg.dependencies, extra);

const reactVersion = String(bundled.react).replace(/^[~^]/, '');
const [major, minor] = reactVersion.split('.');
pkg.devDependencies = {
  ...(pkg.devDependencies || {}),
  typescript: bundled.typescript || '^6.0.0',
  '@types/react': bundled['@types/react'] || `~${major}.${minor}.0`,
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Versões fixadas para o Expo', require(path.join(root, 'node_modules/expo/package.json')).version);
console.log(JSON.stringify({ dependencies: pkg.dependencies, devDependencies: pkg.devDependencies }, null, 2));
