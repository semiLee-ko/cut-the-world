import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'cut-the-land',
  brand: {
    displayName: '컷더랜드',
    primaryColor: '#000000',
    bridgeColorMode: 'basic',
    icon: '/assets/player.png',
  },
  web: {
    host: 'localhost',
    port: 7000,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  webViewProps: {
    type: 'game',
  },
  permissions: [],
});
