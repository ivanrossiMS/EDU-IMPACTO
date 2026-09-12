package br.com.impactoedu.agenda;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 34) {
            try {
                registerScreenCaptureCallback(getMainExecutor(), new ScreenCaptureCallback() {
                    @Override
                    public void onScreenCaptured() {
                        runOnUiThread(() -> {
                            if (getBridge() != null && getBridge().getWebView() != null) {
                                getBridge().getWebView().evaluateJavascript(
                                    "window.dispatchEvent(new CustomEvent('impacto:screenshot-attempt'));",
                                    null
                                );
                            }
                        });
                    }
                });
            } catch (Exception e) {
                // Fallback silencioso em builds customizadas
            }
        }
    }
}
