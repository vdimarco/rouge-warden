import UIKit
import Capacitor

/// The root view controller of Reel It In (set in Main.storyboard).
///
/// The player turns the crank with a thumb near the bottom of the screen. With the bottom edge deferred, a swipe up
/// from that edge first shows the home indicator, and only a second swipe leaves the app.
/// The home indicator auto-hides through Capacitor's SystemBars plugin ("hidden": true in capacitor.config.json),
/// because Capacitor already overrides prefersHomeIndicatorAutoHidden for CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return [.bottom]
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }
}
