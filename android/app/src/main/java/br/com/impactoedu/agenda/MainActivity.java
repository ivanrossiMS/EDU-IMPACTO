package br.com.impactoedu.agenda;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ImpactoEdu";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        CrashHandler.init(this);

        try {
            registerPlugin(NativeSettingsPlugin.class);
        } catch (Throwable t) {
            Log.e(TAG, "Falha ao registrar NativeSettingsPlugin: " + t.getMessage(), t);
        }

        try {
            super.onCreate(savedInstanceState);
        } catch (Throwable t) {
            Log.e(TAG, "FATAL EXCEPTION no super.onCreate: " + t.getMessage(), t);
            CrashHandler.showCrash(this, t);
        }
    }
}

