package br.com.impactoedu.agenda;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ImpactoEdu";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "FATAL CRASH on thread " + thread.getName() + ": " + throwable.getMessage(), throwable);
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        registerPlugin(NativeSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

