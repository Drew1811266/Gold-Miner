import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let config = WKWebViewConfiguration()
    config.defaultWebpagePreferences.allowsContentJavaScript = true

    let webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = self
    webView.allowsBackForwardNavigationGestures = false
    self.webView = webView

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 720),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "黄金矿工"
    window.center()
    window.contentView = webView
    window.makeKeyAndOrderFront(nil)
    window.delegate = self
    self.window = window

    NSApp.activate(ignoringOtherApps: true)
    ensureMainMenu()
    loadGame()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  private func ensureMainMenu() {
    if NSApp.mainMenu != nil { return }

    let mainMenu = NSMenu()
    NSApp.mainMenu = mainMenu

    let appMenuItem = NSMenuItem()
    mainMenu.addItem(appMenuItem)

    let appMenu = NSMenu()
    appMenuItem.submenu = appMenu

    appMenu.addItem(
      withTitle: "退出黄金矿工",
      action: #selector(NSApplication.terminate(_:)),
      keyEquivalent: "q"
    )

    let viewMenuItem = NSMenuItem()
    mainMenu.addItem(viewMenuItem)
    let viewMenu = NSMenu(title: "视图")
    viewMenuItem.submenu = viewMenu

    let reloadItem = NSMenuItem(title: "重新加载", action: #selector(reloadPage), keyEquivalent: "r")
    reloadItem.keyEquivalentModifierMask = [.command]
    viewMenu.addItem(reloadItem)

    let fullScreenItem = NSMenuItem(title: "切换全屏", action: #selector(toggleFullScreen), keyEquivalent: "f")
    fullScreenItem.keyEquivalentModifierMask = [.command, .control]
    viewMenu.addItem(fullScreenItem)
  }

  @objc private func reloadPage() {
    webView?.reload()
  }

  @objc private func toggleFullScreen() {
    window?.toggleFullScreen(nil)
  }

  private func loadGame() {
    guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html") else {
      showMissingResourcesAlert()
      return
    }
    let readAccess = indexURL.deletingLastPathComponent()
    webView?.loadFileURL(indexURL, allowingReadAccessTo: readAccess)
  }

  private func showMissingResourcesAlert() {
    let alert = NSAlert()
    alert.messageText = "缺少游戏资源"
    alert.informativeText = "找不到 index.html。请确认已将游戏文件复制到 App 的 Resources 目录。"
    alert.alertStyle = .critical
    alert.addButton(withTitle: "退出")
    alert.runModal()
    NSApp.terminate(nil)
  }
}

@main
enum GoldMinerApp {
  static func main() {
    let app = NSApplication.shared
    app.setActivationPolicy(.regular)

    let delegate = AppDelegate()
    app.delegate = delegate

    app.run()
  }
}

