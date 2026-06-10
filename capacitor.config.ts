import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.impactoedu.agenda',
  appName: 'Impacto Edu',
  webDir: 'out',
  server: {
    url: 'https://impacto-edu-vy5f1l1.netlify.app',
    cleartext: true,
  },
};

export default config;
