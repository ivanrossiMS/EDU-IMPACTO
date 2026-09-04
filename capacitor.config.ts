import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.impactoedu.agenda',
  appName: 'Impacto Edu',
  webDir: 'out',
  server: {
    url: 'https://resilient-cuchufli-2b4125.netlify.app',
    cleartext: true,
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK'
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#0A0F24",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    PrivacyScreen: {
      enable: false,
    }
  }
};

export default config;
