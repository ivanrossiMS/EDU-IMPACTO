package br.com.impactoedu.agenda;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class CrashActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final String errorMessage = getIntent().getStringExtra("error_message");
        final String stackTrace = getIntent().getStringExtra("stack_trace");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0A0F24"));
        root.setPadding(48, 80, 48, 48);

        TextView title = new TextView(this);
        title.setText("Diagnóstico de Inicialização");
        title.setTextColor(Color.parseColor("#38BDF8"));
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, 0, 0, 16);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("O aplicativo encontrou um erro no Android antes de concluir a abertura. Por favor, envie uma captura desta tela:");
        subtitle.setTextColor(Color.parseColor("#E2E8F0"));
        subtitle.setTextSize(14);
        subtitle.setPadding(0, 0, 0, 24);
        root.addView(subtitle);

        ScrollView scrollView = new ScrollView(this);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.0f
        );
        scrollView.setLayoutParams(scrollParams);
        scrollView.setBackgroundColor(Color.parseColor("#050814"));
        scrollView.setPadding(24, 24, 24, 24);

        TextView errorText = new TextView(this);
        errorText.setText((errorMessage != null ? errorMessage : "Erro desconhecido") + "\n\n" + (stackTrace != null ? stackTrace : ""));
        errorText.setTextColor(Color.parseColor("#F87171"));
        errorText.setTextSize(12);
        errorText.setTypeface(Typeface.MONOSPACE);
        scrollView.addView(errorText);
        root.addView(scrollView);

        LinearLayout buttonsLayout = new LinearLayout(this);
        buttonsLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonsLayout.setPadding(0, 32, 0, 0);

        Button copyBtn = new Button(this);
        copyBtn.setText("Copiar Erro");
        copyBtn.setBackgroundColor(Color.parseColor("#1E293B"));
        copyBtn.setTextColor(Color.WHITE);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        btnParams.setMargins(0, 0, 16, 0);
        copyBtn.setLayoutParams(btnParams);
        copyBtn.setOnClickListener(v -> {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("ImpactoEdu Crash", errorText.getText().toString());
            clipboard.setPrimaryClip(clip);
            Toast.makeText(this, "Erro copiado para a área de transferência!", Toast.LENGTH_SHORT).show();
        });
        buttonsLayout.addView(copyBtn);

        Button restartBtn = new Button(this);
        restartBtn.setText("Reiniciar App");
        restartBtn.setBackgroundColor(Color.parseColor("#2563EB"));
        restartBtn.setTextColor(Color.WHITE);
        restartBtn.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        restartBtn.setOnClickListener(v -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            finish();
        });
        buttonsLayout.addView(restartBtn);

        root.addView(buttonsLayout);
        setContentView(root);
    }
}
