package br.com.impactoedu.agenda;

import android.app.Application;
import com.onesignal.OneSignal;

/**
 * Application class do Impacto EDU.
 *
 * Responsabilidades:
 *  1. Instalar o CrashHandler global antes de qualquer outro código.
 *  2. Pré-inicializar o contexto do OneSignal (initWithContext) ANTES do
 *     Capacitor Bridge carregar os plugins. Isso garante que qualquer chamada
 *     de plugin (ex.: getPermission, canRequestPermission, hasPermission)
 *     disparada pelo lado JS nunca encontre OneSignal sem contexto registrado,
 *     evitando o IllegalStateException: "Must call 'initWithContext' before use".
 *
 *  Nota: initWithContext apenas registra o Context e o AppId no SDK.
 *  A inicialização completa (listeners, login de usuário, etc.) ainda ocorre
 *  via JS quando notificationService.initialize() chama OneSignalNative.initialize().
 */
public class EduApp extends Application {

    // App ID do OneSignal — deve ser o mesmo valor de NEXT_PUBLIC_ONESIGNAL_APP_ID
    private static final String ONESIGNAL_APP_ID = "1d652b2a-7b06-4b07-984f-f47e0a4b37fc";

    @Override
    public void onCreate() {
        super.onCreate();

        // 1. Handler global de crashes (mostra CrashActivity em vez de fechar silenciosamente)
        CrashHandler.init(this);

        // 2. Pré-inicializar contexto do OneSignal para evitar crash em chamadas precoces de plugin
        try {
            OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        } catch (Throwable t) {
            // Silencioso: se falhar aqui, o lado JS tentará novamente via initialize()
        }
    }
}
