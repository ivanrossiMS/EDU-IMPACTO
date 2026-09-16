import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.impactoedu.agenda',
  appName: 'Impacto Edu',
  webDir: 'out',
  server: {
    url: 'https://impacto-edu.net',
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
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0A0F24",
      showSpinner: false,
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
