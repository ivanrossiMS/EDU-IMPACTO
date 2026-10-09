import UIKit
import Capacitor
import Security

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. Limpeza de resíduos de segurança em caso de nova instalação ou reinstalação pós-exclusão
        clearKeychainOnFreshInstall()

        // 2. Garantir fundo escuro (#0A0F24) na janela e na WKWebView para eliminar qualquer flash branco na inicialização
        let darkBackground = UIColor(red: 10/255.0, green: 15/255.0, blue: 36/255.0, alpha: 1.0)
        window?.backgroundColor = darkBackground
        if let bridgeVC = window?.rootViewController as? CAPBridgeViewController {
            bridgeVC.view.backgroundColor = darkBackground
            bridgeVC.webView?.backgroundColor = darkBackground
            bridgeVC.webView?.isOpaque = false
            bridgeVC.webView?.scrollView.backgroundColor = darkBackground
        }
        return true
    }

    /**
     * Limpa o Keychain residual caso seja uma primeira instalação ou reinstalação após o app ter sido deletado.
     * Preserva intacto o Keychain se for uma atualização de versão ou se o app já tiver rodado neste dispositivo.
     */
    private func clearKeychainOnFreshInstall() {
        let defaults = UserDefaults.standard
        let hasRunBeforeKey = "hasRunBefore"
        let hasRunBefore = defaults.bool(forKey: hasRunBeforeKey)

        if !hasRunBefore {
            // Verifica se é uma atualização de versão anterior que já continha dados salvos no UserDefaults
            let existingKeys = defaults.dictionaryRepresentation().keys
            let hasExistingAppData = existingKeys.contains { key in
                key.hasPrefix("CapacitorStorage.") || key.hasPrefix("edu_") || key.hasPrefix("edu-")
            }

            // Se NÃO existem dados prévios no UserDefaults, trata-se de uma instalação limpa (ou reinstalação pós-delete)
            if !hasExistingAppData {
                NSLog("[ImpactoEdu] Fresh install ou reinstalação detectada. Limpando Keychain residual...")
                let secClasses: [CFString] = [
                    kSecClassGenericPassword,
                    kSecClassInternetPassword,
                    kSecClassCertificate,
                    kSecClassKey,
                    kSecClassIdentity
                ]
                for secClass in secClasses {
                    let query: [String: Any] = [kSecClass as String: secClass]
                    SecItemDelete(query as CFDictionary)
                }
            } else {
                NSLog("[ImpactoEdu] Atualização de versão existente detectada. Preservando credenciais no Keychain.")
            }

            defaults.set(true, forKey: hasRunBeforeKey)
            defaults.synchronize()
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

/**
 * NativeSettingsPlugin — Plugin Capacitor para abertura dos Ajustes do iOS.
 * Permite ao app abrir diretamente os Ajustes do Impacto Edu sem intermediários em inglês.
 */
@objc(NativeSettingsPlugin)
public class NativeSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSettingsPlugin"
    public let jsName = "NativeSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Cannot create settings URL")
                return
            }
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:]) { success in
                    if success {
                        call.resolve(["opened": true])
                    } else {
                        call.reject("Failed to open settings")
                    }
                }
            } else {
                call.reject("Cannot open settings URL")
            }
        }
    }
}

