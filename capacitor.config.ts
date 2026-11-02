import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Play Store package name; it can never change once the app is published.
  appId: 'com.sinanerkan.tastetour',
  appName: 'Taste Tour',
  webDir: 'dist',
  android: {
    // Game assets are bundled, so the WebView never needs plain HTTP.
    allowMixedContent: false,
  },
};

export default config;
