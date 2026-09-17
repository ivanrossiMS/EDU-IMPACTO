package br.com.impactoedu.agenda;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.util.Log;
import java.lang.reflect.Method;

/**
 * Application class do Impacto EDU.
 *
 * Responsabilidades:
 *  1. Instalar o CrashHandler global antes de qualquer outro código da aplicação.
 *  2. Pré-inicializar o contexto do OneSignal (initWithContext) via Reflection ANTES
 *     do Capacitor Bridge carregar os plugins.
 *     - Por que Reflection? O módulo ':app' não possui dependência de compilação direta
 *       do SDK nativo do OneSignal (ela é empacotada no APK pelo plugin Capacitor).
 *       A Reflection permite registrar o contexto na JVM em runtime sem causar
 *       erros de 'cannot find symbol' no javac.
 *     - Isso previne em definitivo o IllegalStateException: "Must call 'initWithContext' before use"
 *       caso qualquer chamada de permissão ocorra precocemente.
 */
public class EduApp extends Application {

    private static final String TAG = "EduApp";
    private static final String ONESIGNAL_APP_ID = "1d652b2a-7b06-4b07-984f-f47e0a4b37fc";

    @Override
    public void onCreate() {
        super.onCreate();

        // 1. Instalar handler global de crashes
        CrashHandler.init(this);

        // 2. Criar canal de alta prioridade para garantir entrega com app fechado no Android 8+
        createNotificationChannel();

        // 3. Pré-inicializar o contexto do OneSignal nativamente via Reflection
        initOneSignalSafely();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    NotificationChannel channel = new NotificationChannel(
                        "impacto_edu_default",
                        "Avisos e Comunicados Importantes",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Notificações em tempo real da Agenda Digital");
                    channel.enableLights(true);
                    channel.enableVibration(true);
                    channel.setShowBadge(true);
                    manager.createNotificationChannel(channel);
                    Log.i(TAG, "NotificationChannel 'impacto_edu_default' criado com alta prioridade.");
                }
            } catch (Throwable t) {
                Log.w(TAG, "Falha ao criar canal de notificação: " + t.getMessage());
            }
        }
    }

    private void initOneSignalSafely() {
        try {
            Class<?> oneSignalClass = Class.forName("com.onesignal.OneSignal");
            Method initMethod = oneSignalClass.getMethod("initWithContext", Context.class, String.class);
            initMethod.invoke(null, this, ONESIGNAL_APP_ID);
            Log.i(TAG, "OneSignal pre-inicializado com sucesso via Reflection.");
        } catch (ClassNotFoundException e) {
            Log.w(TAG, "Classe OneSignal nao localizada no classpath de runtime: " + e.getMessage());
        } catch (Throwable t) {
            Log.w(TAG, "Aviso ao inicializar OneSignal via Reflection: " + t.getMessage());
        }
    }
}
