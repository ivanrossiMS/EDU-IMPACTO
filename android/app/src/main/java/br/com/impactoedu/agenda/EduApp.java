package br.com.impactoedu.agenda;

import android.app.Application;

public class EduApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        CrashHandler.init(this);
    }
}
