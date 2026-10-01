#!/usr/bin/env bash
# Builds the In Full Swing APK for Meta Quest from quest/twa-manifest.json with Meta's Bubblewrap fork.
# The APK is a Trusted Web Activity: it opens https://<host>/vr/?source=pwa in the Quest Browser engine.
# It installs what it needs (Bubblewrap CLI, JDK 17, Android SDK 34) into quest/.tools, so the first run downloads about 1 GB.
#
# Usage: quest/build-apk.sh [--local] [--out FILE]
#   --local     download the icons and the web manifest from this checkout (a local server over public/),
#               not from the live host. Use it before the files are deployed. The APK still opens the live host.
#   --out FILE  also copy the signed APK to FILE
# Environment:
#   BUBBLEWRAP_KEYSTORE_PASSWORD, BUBBLEWRAP_KEY_PASSWORD   passwords (asked for when missing and a terminal is open)
#   BUBBLEWRAP_KEYSTORE   keystore path (default ~/.android/fullswing.keystore; created when missing; never inside the repo)
#   BUBBLEWRAP_KEY_ALIAS  key alias (default fullswing)
#   KEY_DNAME             the certificate name for a new key (default "CN=Cottage Arcade, O=Cottage Arcade, C=CA")
#   QUEST_TOOLS           where the tools go (default quest/.tools)
#   QUEST_PROJECT         where the generated Android project goes (default quest/android)
#   JAVA17_HOME           a JDK 17 to use instead of downloading one
#   ACCEPT_ANDROID_SDK_LICENSES=yes   accept the Android SDK licenses with no questions (for a run with no terminal)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
TOOLS="${QUEST_TOOLS:-$HERE/.tools}"
PROJECT="${QUEST_PROJECT:-$HERE/android}"
KEYSTORE="${BUBBLEWRAP_KEYSTORE:-$HOME/.android/fullswing.keystore}"
KEY_ALIAS="${BUBBLEWRAP_KEY_ALIAS:-fullswing}"
KEY_DNAME="${KEY_DNAME:-CN=Cottage Arcade, O=Cottage Arcade, C=CA}"
CLI_VERSION="1.24.1"
BUILD_TOOLS="34.0.0"
PLATFORM="android-34"
CMDLINE_TOOLS="11076708" # Android command-line tools 12.0 (needs Java 17)
JDK_TAG="jdk-17.0.11+9"  # the JDK 17 that Bubblewrap itself pins

LOCAL=0
OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --local) LOCAL=1 ;;
    --out) OUT="$2"; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '\n== %s\n' "$*"; }
die() { printf 'build-apk: %s\n' "$*" >&2; exit 1; }
abspath() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
KEYSTORE="$(abspath "$KEYSTORE")"
TOOLS="$(abspath "$TOOLS")"
PROJECT="$(abspath "$PROJECT")"
case "$KEYSTORE/" in "$REPO"/*) die "The keystore ($KEYSTORE) is inside the repository. Keep it outside git: set BUBBLEWRAP_KEYSTORE." ;; esac

# ---------------- node and java ----------------
command -v node >/dev/null || die "Node.js 18 or later is required. Install it from https://nodejs.org and run again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18 or later is required (you have $(node --version))."
command -v npm >/dev/null || die "npm is required (it comes with Node.js)."
command -v curl >/dev/null || die "curl is required."
command -v unzip >/dev/null || die "unzip is required."
HOST="$(node -p 'require(process.argv[1]).host' "$HERE/twa-manifest.json")"
PKG="$(node -p 'require(process.argv[1]).packageId' "$HERE/twa-manifest.json")"

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in Linux) PLAT=linux ;; Darwin) PLAT=mac ;; *) die "This script runs on Linux and macOS only. On Windows, use WSL." ;; esac
case "$ARCH" in x86_64|amd64) JARCH=x64 ;; arm64|aarch64) JARCH=aarch64 ;; *) die "Unsupported CPU: $ARCH" ;; esac

is_jdk17() { [ -x "$1/bin/java" ] && [ -x "$1/bin/keytool" ] && grep -q 'JAVA_VERSION="17\.' "$1/release" 2>/dev/null; }
mkdir -p "$TOOLS"
JDK=""
if [ -n "${JAVA17_HOME:-}" ]; then
  is_jdk17 "$JAVA17_HOME" || die "JAVA17_HOME ($JAVA17_HOME) is not a JDK 17."
  JDK="$JAVA17_HOME"
elif [ -n "${JAVA_HOME:-}" ] && is_jdk17 "$JAVA_HOME"; then
  JDK="$JAVA_HOME"
elif command -v java >/dev/null && JH="$(java -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java.home = //p')" && is_jdk17 "$JH"; then
  JDK="$JH"
else
  # Bubblewrap and its Gradle build need JDK 17 exactly. Download Temurin 17 once into the tools folder.
  JDK_DIR="$TOOLS/jdk17"
  JDK_HOME="$JDK_DIR"; [ "$PLAT" = mac ] && JDK_HOME="$JDK_DIR/Contents/Home"
  if ! is_jdk17 "$JDK_HOME"; then
    command -v java >/dev/null && echo "Found $(java -version 2>&1 | grep -m1 ' version '), but Bubblewrap needs JDK 17."
    say "Downloading Temurin JDK 17 into $JDK_DIR"
    V="${JDK_TAG#jdk-}"; V="${V/+/_}"
    URL="https://github.com/adoptium/temurin17-binaries/releases/download/$JDK_TAG/OpenJDK17U-jdk_${JARCH}_${PLAT}_hotspot_${V}.tar.gz"
    rm -rf "$JDK_DIR" && mkdir -p "$JDK_DIR"
    curl -fL --retry 3 -o "$TOOLS/jdk17.tar.gz" "$URL"
    tar -xzf "$TOOLS/jdk17.tar.gz" -C "$JDK_DIR" --strip-components 1
    rm -f "$TOOLS/jdk17.tar.gz"
  fi
  JDK="$JDK_HOME"
fi
is_jdk17 "$JDK" || die "No JDK 17 at $JDK."
export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"
echo "Node $(node --version), $("$JDK/bin/java" -version 2>&1 | grep -m1 ' version ') at $JDK"

# ---------------- Bubblewrap CLI ----------------
CLI_DIR="$TOOLS/cli"
BW="$CLI_DIR/node_modules/@meta-quest/bubblewrap-cli/bin/bubblewrap.js"
if [ ! -f "$BW" ] || [ "$(node -p "require('$CLI_DIR/node_modules/@meta-quest/bubblewrap-cli/package.json').version")" != "$CLI_VERSION" ]; then
  say "Installing @meta-quest/bubblewrap-cli@$CLI_VERSION into $CLI_DIR"
  mkdir -p "$CLI_DIR"
  npm install --prefix "$CLI_DIR" --no-audit --no-fund --loglevel=error "@meta-quest/bubblewrap-cli@$CLI_VERSION"
fi

# ---------------- Android SDK ----------------
SDK="$TOOLS/android-sdk"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKMANAGER" ]; then
  say "Downloading the Android command-line tools into $SDK"
  mkdir -p "$SDK/cmdline-tools"
  curl -fL --retry 3 -o "$TOOLS/cmdline-tools.zip" "https://dl.google.com/android/repository/commandlinetools-${PLAT}-${CMDLINE_TOOLS}_latest.zip"
  rm -rf "$SDK/cmdline-tools/latest" "$SDK/cmdline-tools/cmdline-tools"
  unzip -q "$TOOLS/cmdline-tools.zip" -d "$SDK/cmdline-tools"
  mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -f "$TOOLS/cmdline-tools.zip"
fi
# Bubblewrap checks that the SDK folder has a tools/ or bin/ folder (its own installer puts sdkmanager in bin/)
[ -e "$SDK/tools" ] || [ -e "$SDK/bin" ] || ln -s cmdline-tools/latest/bin "$SDK/bin"
if [ ! -x "$SDK/build-tools/$BUILD_TOOLS/apksigner" ] || [ ! -f "$SDK/platforms/$PLATFORM/android.jar" ]; then
  say "Installing Android build-tools $BUILD_TOOLS and $PLATFORM"
  # the SDK packages have licenses that you must accept: in a terminal, sdkmanager shows each one and asks you
  if [ "${ACCEPT_ANDROID_SDK_LICENSES:-}" = yes ]; then
    yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null || true
  elif [ -t 0 ]; then
    "$SDKMANAGER" --sdk_root="$SDK" --licenses
  else
    die "Accept the Android SDK licenses: run this script in a terminal, or read them and set ACCEPT_ANDROID_SDK_LICENSES=yes."
  fi
  "$SDKMANAGER" --sdk_root="$SDK" "build-tools;$BUILD_TOOLS" "platforms;$PLATFORM" "platform-tools" >/dev/null
fi
export ANDROID_HOME="$SDK"
BT="$SDK/build-tools/$BUILD_TOOLS"

CONFIG="$TOOLS/bubblewrap-config.json"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ jdkPath: process.argv[2], androidSdkPath: process.argv[3] }))' "$CONFIG" "$JDK" "$SDK"

# ---------------- signing key ----------------
ask() { # ask VAR "prompt": read a password without echo when a terminal is open
  if [ -z "${!1:-}" ]; then
    [ -t 0 ] || die "Set $1 (no terminal to ask for it)."
    read -r -s -p "$2: " "${1?}"; echo
    export "${1?}"
  fi
}
ask BUBBLEWRAP_KEYSTORE_PASSWORD "Keystore password"
# a PKCS12 keystore has one password, so the key password defaults to the keystore password
export BUBBLEWRAP_KEY_PASSWORD="${BUBBLEWRAP_KEY_PASSWORD:-$BUBBLEWRAP_KEYSTORE_PASSWORD}"
[ ${#BUBBLEWRAP_KEYSTORE_PASSWORD} -ge 6 ] || die "The keystore password must have 6 characters or more."
if [ ! -f "$KEYSTORE" ]; then
  [ "$BUBBLEWRAP_KEY_PASSWORD" = "$BUBBLEWRAP_KEYSTORE_PASSWORD" ] || die "A new PKCS12 keystore needs the same keystore and key password."
  say "Creating a new signing key at $KEYSTORE"
  echo "Keep this file and its password safe. Every update to the app must use the same key."
  mkdir -p "$(dirname "$KEYSTORE")"
  "$JDK/bin/keytool" -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 20000 \
    -dname "$KEY_DNAME" -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD -keypass:env BUBBLEWRAP_KEY_PASSWORD
  chmod 600 "$KEYSTORE"
fi
"$JDK/bin/keytool" -list -keystore "$KEYSTORE" -alias "$KEY_ALIAS" -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD >/dev/null \
  || die "Cannot open key \"$KEY_ALIAS\" in $KEYSTORE with that password."

# ---------------- the Android project ----------------
mkdir -p "$PROJECT"
MANIFEST="$PROJECT/twa-manifest.json"
SERVER_PID=""
cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT
BASE=""
if [ "$LOCAL" = 1 ]; then
  # a tiny static server over public/ on a free port; it prints its port and runs until this script ends
  PORT_FILE="$(mktemp)"
  node -e '
    const http = require("http"), fs = require("fs"), path = require("path");
    const root = process.argv[1], types = { ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };
    const srv = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(new URL(q.url, "http://x").pathname));
      if (!p.startsWith(root)) { r.writeHead(403); return r.end(); }
      fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); r.end(b); });
    }).listen(0, "127.0.0.1", () => fs.writeFileSync(process.argv[2], String(srv.address().port)));
  ' "$REPO/public" "$PORT_FILE" &
  SERVER_PID=$!
  for _ in $(seq 50); do [ -s "$PORT_FILE" ] && break; sleep 0.1; done
  [ -s "$PORT_FILE" ] || die "The local server did not start."
  BASE="http://127.0.0.1:$(cat "$PORT_FILE")"
  rm -f "$PORT_FILE"
  echo "Serving public/ at $BASE for the icons and the web manifest"
fi
# The project gets its own copy of twa-manifest.json: the signing key path filled in and, with --local, the download URLs
# pointed at the local server. The host and start URL stay the same, so the APK opens the live site.
node -e '
  const fs = require("fs"), [src, dst, ks, alias, base] = process.argv.slice(1);
  const m = JSON.parse(fs.readFileSync(src, "utf8"));
  m.signingKey = { path: ks, alias };
  if (base) for (const k of ["iconUrl", "maskableIconUrl", "monochromeIconUrl", "webManifestUrl"]) if (m[k]) { const u = new URL(m[k]); m[k] = base + u.pathname; }
  fs.writeFileSync(dst, JSON.stringify(m, null, 2) + "\n");
' "$HERE/twa-manifest.json" "$MANIFEST" "$KEYSTORE" "$KEY_ALIAS" "$BASE"

say "Generating the Android project in $PROJECT"
# update --skipVersionUpgrade regenerates the project from the manifest with no questions; versions come from twa-manifest.json
(cd "$PROJECT" && node "$BW" update --skipVersionUpgrade --manifest="$MANIFEST" --directory="$PROJECT" --config="$CONFIG")
if [ -n "$BASE" ]; then
  # the template also writes the web manifest URL into a string resource: point it back at the live host
  node -e 'const fs = require("fs"), [f, a, b] = process.argv.slice(1); fs.writeFileSync(f, fs.readFileSync(f, "utf8").split(a).join(b));' "$PROJECT/app/build.gradle" "$BASE" "https://$HOST"
fi
say "Applying the Horizon Store manifest rules"
node "$HERE/patch-android.mjs" "$PROJECT"

say "Building and signing"
# build sees an unchanged manifest checksum, so it keeps the patched project; passwords come from the environment
(cd "$PROJECT" && node "$BW" build --manifest="$MANIFEST" --directory="$PROJECT" --config="$CONFIG" --signingKeyPath="$KEYSTORE" --signingKeyAlias="$KEY_ALIAS")
APK="$PROJECT/app-release-signed.apk"
[ -f "$APK" ] || die "No signed APK at $APK."
# Meta asks for APK Signature Scheme v2 (VRC.Quest.Packaging.2). apksigner adds v2 and v3, but with minSdk 28 or more its
# verify command reports only v3 unless you ask it to check as an older device would.
VERIFY="$("$BT/apksigner" verify --verbose --min-sdk-version 24 "$APK")" || die "apksigner cannot verify $APK."
grep -q "v2 scheme (APK Signature Scheme v2): true" <<<"$VERIFY" || die "$APK has no v2 signature."
echo "The APK verifies with APK Signature Schemes v2 and v3."
if [ -n "$OUT" ]; then mkdir -p "$(dirname "$OUT")"; cp "$APK" "$OUT"; APK="$(abspath "$OUT")"; fi

# ---------------- what to do next ----------------
SHA="$("$JDK/bin/keytool" -list -v -keystore "$KEYSTORE" -alias "$KEY_ALIAS" -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD | sed -n 's/^[[:space:]]*SHA256: *//p')"
say "Done"
echo "APK:    $APK"
echo "Bundle: $PROJECT/app-release-bundle.aab"
echo "SHA-256 fingerprint of your signing key:"
echo "  $SHA"
echo
echo "1. Put that fingerprint in public/.well-known/assetlinks.json (package $PKG) in place of the placeholder, then deploy."
echo "2. Check it:  curl -s https://$HOST/.well-known/assetlinks.json"
echo "3. Install:   adb install -r \"$APK\""
echo "4. Watch:     adb logcat | grep -i \"TWA verification\""
