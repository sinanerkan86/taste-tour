import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Play Store package name; it can never change once the app is published.
  appId: 'com.sinanerkan.tastetour',
  appName: 'Taste Tour',
  webDir: 'dist',
  plugins: {
    // Full screen game: status and navigation bars stay hidden until the player swipes.
    SystemBars: { hidden: true },
    // Status bar icon (a white chef's hat, android/app/src/main/res/drawable/ic_stat_notify.xml) and its tint.
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#D8342A' },
  },
  android: {
    // Game assets are bundled, so the WebView never needs plain HTTP.
    allowMixedContent: false,
  },
};

export default config;
