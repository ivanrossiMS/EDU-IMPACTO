import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.impactoedu.agenda',
  appName: 'Impacto Edu',
  webDir: 'out',
  server: {
    url: 'https://resilient-cuchufli-2b4125.netlify.app',
    cleartext: true,
  },
};

export default config;
