/**
 * OneSignalSDKWorker.js
 *
 * AUDITORIA: Este arquivo DEVE estar na raiz do domínio público (/public).
 * Ele delega todo o controle de push para o SDK oficial do OneSignal v16.
 *
 * NÃO remova nem modifique este arquivo sem testar em produção.
 *
 * Compatível com: Chrome, Firefox, Edge, Safari 16.4+ (iOS PWA), Android Chrome
 *
 * skipWaiting + clients.claim: garante que o novo service worker seja ativado
 * imediatamente ao instalar (sem aguardar o usuário fechar todas as abas).
 * Necessário para que pushes enviados logo após um deploy sejam recebidos corretamente.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
