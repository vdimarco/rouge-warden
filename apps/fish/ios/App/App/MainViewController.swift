import UIKit
import Capacitor

/// The root view controller of Reel It In (set in Main.storyboard).
///
/// The player turns the crank with a thumb near the bottom of the screen. With the bottom edge deferred, a swipe up
/// from that edge first shows the home indicator, and only a second swipe leaves the app.
///
/// The home indicator is NOT set to auto-hide. Developers report that iOS ignores the deferred edges when
/// prefersHomeIndicatorAutoHidden is true, and then one crank stroke can leave the app. A deferred edge already dims
/// the indicator. (Check this on an iPhone with the 50-crank test in apps/fish/README.md.)
/// For this reason SystemBars has "hidden": false in capacitor.config.json (with "hidden": true, Capacitor's
/// SystemBars extension makes prefersHomeIndicatorAutoHidden return true). Do not call SystemBars.hide() on iOS.
///
/// The status bar is hidden here instead, on every screen. UIStatusBarHidden in Info.plist hides it at launch.
class MainViewController: CAPBridgeViewController {

    override var prefersStatusBarHidden: Bool {
        return true
    }

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return [.bottom]
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }
}
