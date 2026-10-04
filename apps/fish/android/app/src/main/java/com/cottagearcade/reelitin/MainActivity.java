package com.cottagearcade.reelitin;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

/**
 * Reel It In runs full screen in portrait. The player turns the crank with a thumb near a bottom corner of the
 * screen, so this activity keeps the system back gesture out of both bottom corners.
 */
public class MainActivity extends BridgeActivity {

    /** Android honours at most 200 dp of gesture exclusion on each side edge. The crank is at most 160 CSS px tall. */
    private static final int CORNER_DP = 200;

    /**
     * The largest system font scale that the web view follows. Up to 1.3 (the largest setting before Android 14) the
     * page text grows with the system font size. Above it, the text stops at 130%, so the fixed game layout does not
     * break. Look at this value again when the game's own Text size setting ships.
     */
    private static final float MAX_TEXT_SCALE = 1.3f;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Draw the lake under a camera cutout on the short edges. The page keeps its controls clear of it
        // with the safe-area insets that Capacitor's SystemBars gives it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attrs);
        }
        hideSystemBars();

        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;
        // SystemBars ("hidden": false, so that iOS keeps its bottom-edge deferral) shows the bars from a task that
        // it queued while the plugins loaded. This task runs after it and hides them again.
        bridge.executeOnMainThread(this::hideSystemBars);
        // The web view follows the system font size by default. Keep that, up to MAX_TEXT_SCALE.
        float fontScale = getResources().getConfiguration().fontScale;
        if (fontScale > MAX_TEXT_SCALE) webView.getSettings().setTextZoom(Math.round(MAX_TEXT_SCALE * 100));
        webView.addOnLayoutChangeListener((v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> excludeCrankCorners(v));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // The bars come back after a swipe from an edge, a dialog or a trip to another app. Hide them again.
        if (hasFocus) hideSystemBars();
    }

    /** Immersive mode: no status bar and no navigation bar. A swipe from an edge shows them for a moment. */
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * Keeps the back gesture out of the bottom 200 dp of both side edges, where the crank sits (on the left in
     * touch play, on either side in motion play). The home gesture at the bottom edge cannot be excluded.
     */
    private void excludeCrankCorners(View view) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        int width = view.getWidth();
        int height = view.getHeight();
        if (width == 0 || height == 0) return;
        int size = Math.round(CORNER_DP * getResources().getDisplayMetrics().density);
        int top = Math.max(0, height - size);
        int side = Math.min(size, width / 2);
        List<Rect> rects = new ArrayList<>();
        rects.add(new Rect(0, top, side, height));
        rects.add(new Rect(width - side, top, width, height));
        view.setSystemGestureExclusionRects(rects);
    }
}
