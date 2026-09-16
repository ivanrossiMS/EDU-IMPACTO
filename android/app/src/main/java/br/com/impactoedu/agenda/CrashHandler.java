package br.com.impactoedu.agenda;

import android.content.Context;
import android.content.Intent;
import android.os.Process;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

public class CrashHandler {
    private static final String TAG = "ImpactoEduCrash";
    private static boolean initialized = false;

    public static void init(Context context) {
        if (initialized) return;
        initialized = true;

        final Context appContext = context.getApplicationContext();

        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "FATAL UNCAUGHT EXCEPTION on thread " + thread.getName(), throwable);
            showCrash(appContext, throwable);
        });
    }

    public static void showCrash(Context context, Throwable throwable) {
        try {
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);
            throwable.printStackTrace(pw);
            String stackTrace = sw.toString();

            try {
                File crashFile = new File(context.getFilesDir(), "crash_report.txt");
                FileOutputStream fos = new FileOutputStream(crashFile);
                fos.write(stackTrace.getBytes());
                fos.close();
            } catch (Exception ignored) {}

            Intent intent = new Intent(context, CrashActivity.class);
            intent.putExtra("error_message", throwable.getMessage() != null ? throwable.getMessage() : throwable.toString());
            intent.putExtra("stack_trace", stackTrace);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            context.startActivity(intent);

            try {
                Thread.sleep(400);
            } catch (InterruptedException ignored) {}

            Process.killProcess(Process.myPid());
            System.exit(10);
        } catch (Throwable t) {
            Log.e(TAG, "Failed to display CrashActivity", t);
        }
    }
}
