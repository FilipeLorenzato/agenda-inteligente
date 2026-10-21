// Config plugin: atalhos ao segurar o ícone do app (Android App Shortcuts).
// Cada atalho abre um link agenda://… que o App.tsx entende.
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const SHORTCUTS = [
  { id: 'voz', short: 'Falar tarefa', long: 'Nova tarefa por voz', uri: 'agenda://nova?modo=voz' },
  { id: 'nova', short: 'Nova tarefa', long: 'Nova tarefa digitando', uri: 'agenda://nova?modo=texto' },
  { id: 'proximas', short: 'Próximas', long: 'Ver próximas tarefas', uri: 'agenda://proximas' },
];

function withShortcutStrings(config) {
  return withStringsXml(config, (cfg) => {
    const items = [];
    for (const s of SHORTCUTS) {
      items.push({ $: { name: `shortcut_${s.id}_short` }, _: s.short });
      items.push({ $: { name: `shortcut_${s.id}_long` }, _: s.long });
    }
    cfg.modResults = AndroidConfig.Strings.setStringItem(items, cfg.modResults);
    return cfg;
  });
}

function withShortcutMeta(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const meta = (activity['meta-data'] || []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    meta.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    activity['meta-data'] = meta;
    return cfg;
  });
}

function withShortcutFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('withAppShortcuts: defina android.package no app.json');
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });

      for (const s of SHORTCUTS) {
        const src = path.join(cfg.modRequest.projectRoot, 'assets', 'shortcuts', `${s.id}.png`);
        fs.copyFileSync(src, path.join(res, 'drawable', `shortcut_${s.id}.png`));
      }

      const xml = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">',
        ...SHORTCUTS.map(
          (s) => `  <shortcut
    android:shortcutId="${s.id}"
    android:enabled="true"
    android:icon="@drawable/shortcut_${s.id}"
    android:shortcutShortLabel="@string/shortcut_${s.id}_short"
    android:shortcutLongLabel="@string/shortcut_${s.id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="${s.uri.replace(/&/g, '&amp;')}"
      android:targetPackage="${pkg}"
      android:targetClass="${pkg}.MainActivity" />
  </shortcut>`,
        ),
        '</shortcuts>',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(res, 'xml', 'shortcuts.xml'), xml);
      return cfg;
    },
  ]);
}

module.exports = function withAppShortcuts(config) {
  config = withShortcutStrings(config);
  config = withShortcutMeta(config);
  config = withShortcutFiles(config);
  return config;
};
