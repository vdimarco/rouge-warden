#!/usr/bin/env node
// Runs after npx cap sync and npx cap update (the capacitor:sync:after and capacitor:update:after hooks in package.json).
// 1. The Capacitor CLI writes ios/App/CapApp-SPM/Package.swift again on each sync, with only the major iOS version
//    (.iOS(.v16)). This script sets it back to iOS 16.4, the first version with import maps, like the Xcode project.
// 2. It checks the store settings of both native projects, so a sync or a hand edit cannot drop them quietly.
// Usage: node scripts/native-check.mjs   (exit code 1 when a setting is wrong)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS_MIN = "16.4";
const problems = [];
const read = (rel) => { try { return fs.readFileSync(path.join(APP, rel), "utf8"); } catch { return null; } };
const need = (ok, msg) => { if (!ok) problems.push(msg); };

// --- iOS ---
const pkgPath = "ios/App/CapApp-SPM/Package.swift";
const pkg = read(pkgPath);
if (pkg !== null) {
  const fixed = pkg.replace(/platforms:\s*\[\s*\.iOS\([^)]*\)\s*\]/, `platforms: [.iOS("${IOS_MIN}")]`);
  if (fixed !== pkg) { fs.writeFileSync(path.join(APP, pkgPath), fixed); console.log(`native-check: set ${pkgPath} to iOS ${IOS_MIN}`); }
  need(fixed.includes(`.iOS("${IOS_MIN}")`), `${pkgPath}: platforms is not iOS ${IOS_MIN}`);
}
const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
if (pbx !== null) {
  const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map((m) => m[1]);
  need(targets.length > 0 && targets.every((t) => t === IOS_MIN), `project.pbxproj: IPHONEOS_DEPLOYMENT_TARGET is ${targets.join(", ")}, not ${IOS_MIN}`);
  const families = [...pbx.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)].map((m) => m[1]);
  need(families.length > 0 && families.every((f) => f === "1"), `project.pbxproj: TARGETED_DEVICE_FAMILY is ${families.join(", ")}, not 1 (iPhone only)`);
  need(pbx.includes("PrivacyInfo.xcprivacy in Resources"), "project.pbxproj: PrivacyInfo.xcprivacy is not in the App target");
  need(pbx.includes("MainViewController.swift in Sources"), "project.pbxproj: MainViewController.swift is not in the App target");
}
const plist = read("ios/App/App/Info.plist");
if (plist !== null) {
  const block = (key) => { const m = new RegExp(`<key>${key.replace(/[~]/g, "\\$&")}</key>\\s*(<array>[\\s\\S]*?</array>|<array/>|<true/>|<false/>|<string>[^<]*</string>)`).exec(plist); return m ? m[1] : null; };
  const orient = block("UISupportedInterfaceOrientations");
  need(orient && /UIInterfaceOrientationPortrait</.test(orient) && !/Landscape|UpsideDown/.test(orient), "Info.plist: UISupportedInterfaceOrientations must be portrait only");
  need(!plist.includes("UISupportedInterfaceOrientations~ipad"), "Info.plist: remove UISupportedInterfaceOrientations~ipad (iPhone only)");
  need(block("UIStatusBarHidden") === "<true/>", "Info.plist: UIStatusBarHidden must be true");
  need(block("UIRequiresFullScreen") === "<true/>", "Info.plist: UIRequiresFullScreen must be true");
  need(block("ITSAppUsesNonExemptEncryption") === "<false/>", "Info.plist: ITSAppUsesNonExemptEncryption must be false");
  need(!plist.includes("NSMotionUsageDescription"), "Info.plist: no NSMotionUsageDescription (the web view grants motion itself)");
}
const privacy = read("ios/App/App/PrivacyInfo.xcprivacy");
if (pbx !== null) {
  need(privacy !== null, "ios/App/App/PrivacyInfo.xcprivacy is missing");
  if (privacy) {
    need(/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(privacy), "PrivacyInfo.xcprivacy: NSPrivacyTracking must be false");
    need(/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/.test(privacy), "PrivacyInfo.xcprivacy: NSPrivacyCollectedDataTypes must be empty");
    need(/NSPrivacyAccessedAPICategoryUserDefaults[\s\S]*CA92\.1/.test(privacy), "PrivacyInfo.xcprivacy: UserDefaults with reason CA92.1 is missing");
  }
}
const story = read("ios/App/App/Base.lproj/Main.storyboard");
if (story !== null) need(/customClass="MainViewController"/.test(story), "Main.storyboard: the root view controller must be MainViewController");
const mvc = read("ios/App/App/MainViewController.swift");
if (mvc !== null) {
  need(/preferredScreenEdgesDeferringSystemGestures[\s\S]*?\.bottom/.test(mvc), "MainViewController.swift: it must defer the system gesture at the bottom edge");
  need(/override var prefersStatusBarHidden[\s\S]*?return true/.test(mvc), "MainViewController.swift: it must hide the status bar (prefersStatusBarHidden)");
}

// --- Both ---
let config = null;
try { config = JSON.parse(read("capacitor.config.json") || "null"); } catch (e) { problems.push(`capacitor.config.json: not valid JSON (${e.message})`); }
if (config) {
  // With "hidden": true, Capacitor's SystemBars auto-hides the iOS home indicator, and iOS can then ignore the
  // bottom-edge deferral that keeps a crank stroke from leaving the app. MainActivity and MainViewController hide the bars.
  need(config.plugins?.SystemBars?.hidden !== true, 'capacitor.config.json: SystemBars "hidden" must not be true (it auto-hides the iOS home indicator and cancels the bottom-edge deferral)');
  need(config.android?.webContentsDebuggingEnabled !== false, "capacitor.config.json: do not set android.webContentsDebuggingEnabled to false (it turns off chrome://inspect in debug builds; release builds are off already)");
}

// --- Android ---
const manifest = read("android/app/src/main/AndroidManifest.xml");
if (manifest !== null) {
  need(/android:appCategory="game"/.test(manifest), 'AndroidManifest.xml: <application android:appCategory="game"> is missing');
  need(/android:screenOrientation="portrait"/.test(manifest), 'AndroidManifest.xml: the activity must have android:screenOrientation="portrait"');
  need(/android:allowBackup="true"/.test(manifest), 'AndroidManifest.xml: keep android:allowBackup="true" (the save mirror)');
  need(/android\.permission\.VIBRATE/.test(manifest), "AndroidManifest.xml: the VIBRATE permission is missing");
}
const vars = read("android/variables.gradle");
if (vars !== null) {
  need(/minSdkVersion = 24\b/.test(vars), "variables.gradle: minSdkVersion must be 24");
  need(/compileSdkVersion = 36\b/.test(vars) && /targetSdkVersion = 36\b/.test(vars), "variables.gradle: compileSdkVersion and targetSdkVersion must be 36");
}

if (problems.length) {
  console.log("native-check: FAILED");
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("native-check: the iOS and Android store settings are in place");
