package br.com.impactoedu.agenda;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeSettings")
public class NativeSettingsPlugin extends Plugin {

    public NativeSettingsPlugin() {
        super();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);

                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Não foi possível abrir as configurações: " + ex.getMessage());
            }
        }
    }

    private byte[] decodeBase64Png(String rawBase64) {
        if (rawBase64 == null || rawBase64.isEmpty()) return null;
        String clean = rawBase64;
        int commaIdx = clean.indexOf(',');
        if (commaIdx != -1) {
            clean = clean.substring(commaIdx + 1);
        }
        return Base64.decode(clean, Base64.DEFAULT);
    }

    private String sanitizeFileName(String rawName) {
        if (rawName == null || rawName.trim().isEmpty()) {
            return "Boletim_Escolar.png";
        }
        String safe = rawName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!safe.toLowerCase().endsWith(".png")) {
            safe = safe + ".png";
        }
        return safe;
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        try {
            String base64 = call.getString("base64");
            String fileName = sanitizeFileName(call.getString("fileName"));
            byte[] bytes = decodeBase64Png(base64);

            if (bytes == null || bytes.length == 0) {
                call.reject("Imagem inválida.");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ImpactoEdu");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out != null) {
                            out.write(bytes);
                            out.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);

                    JSObject ret = new JSObject();
                    ret.put("saved", true);
                    ret.put("uri", uri.toString());
                    call.resolve(ret);
                    return;
                }
            }

            // Fallback via FileProvider + chooser em versões anteriores ao Android 10
            File cacheFile = new File(getContext().getCacheDir(), fileName);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(bytes);
                fos.flush();
            }
            Uri fileUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                cacheFile
            );
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, fileUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            Intent chooser = Intent.createChooser(intent, "Salvar Boletim");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("saved", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha ao salvar imagem no Android: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        try {
            String base64 = call.getString("base64");
            String fileName = sanitizeFileName(call.getString("fileName"));
            String title = call.getString("title", "Compartilhar Boletim");
            String text = call.getString("text", "");
            byte[] bytes = decodeBase64Png(base64);

            if (bytes == null || bytes.length == 0) {
                call.reject("Imagem inválida.");
                return;
            }

            File cacheFile = new File(getContext().getCacheDir(), fileName);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(bytes);
                fos.flush();
            }

            Uri fileUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                cacheFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("image/png");
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            if (title != null && !title.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            }
            if (text != null && !text.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("shared", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha ao compartilhar imagem no Android: " + e.getMessage());
        }
    }
}
