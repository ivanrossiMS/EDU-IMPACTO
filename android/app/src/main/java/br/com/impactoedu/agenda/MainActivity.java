package br.com.impactoedu.agenda;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.DownloadListener;
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
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().setBackgroundColor(0xFF0A0F24);
                this.bridge.getWebView().setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(
                        String url,
                        String userAgent,
                        String contentDisposition,
                        String mimetype,
                        long contentLength
                    ) {
                        try {
                            if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            }
                        } catch (Throwable dlErr) {
                            Log.e(TAG, "Falha ao abrir download externo: " + dlErr.getMessage(), dlErr);
                        }
                    }
                });
            }
        } catch (Throwable t) {
            Log.e(TAG, "FATAL EXCEPTION no super.onCreate: " + t.getMessage(), t);
            CrashHandler.showCrash(this, t);
        }
    }
}
