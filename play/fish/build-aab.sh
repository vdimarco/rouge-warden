#!/usr/bin/env bash
# Builds Reel It In for Google Play from play/fish/twa-manifest.json with upstream Bubblewrap 1.25.0: a signed Android App Bundle (.aab)
# for the Play Console, and a signed APK for adb.
# The app is a Trusted Web Activity: it opens https://<host>/fish/?source=play in Chrome with no URL bar.
# It installs what it needs (Bubblewrap CLI, JDK 17, Android SDK 36, a Gradle cache) into play/.tools, so the first run downloads about 1.8 GB.
#
# Usage: play/fish/build-aab.sh [--local] [--debug-key] [--out DIR]
#   --local      download the icons and the web manifest from this checkout (a local server over public/), not from the live
#                host. Use it before the web files are deployed. The app still opens the live host.
#   --debug-key  sign with a throwaway key in play/.tools, not with your upload key. For development only.
#                A bundle made this way can NEVER be uploaded to Google Play.
#   --out DIR    where the .aab, the .apk and the fingerprint file go (default play/fish/dist)
# Environment:
#   BUBBLEWRAP_KEYSTORE_PASSWORD, BUBBLEWRAP_KEY_PASSWORD   passwords (asked for when missing and a terminal is open).
#                A password must not contain " $ ` \ or a line break: Bubblewrap passes it through a shell.
#   BUBBLEWRAP_KEYSTORE   upload keystore path (default ~/.android/reelitin-upload.keystore; never inside the repo)
#   BUBBLEWRAP_KEY_ALIAS  key alias (default reelitin)
#   KEY_DNAME             the certificate name for a new key (default "CN=Reel It In, O=Cottage Arcade, C=CA")
#   PLAY_TOOLS            where the tools go (default play/.tools)
#   PLAY_PROJECT          where the generated Android project goes (default play/fish/android)
#   PLAY_PUBLIC           the site files that --local serves (default public)
#   JAVA17_HOME           a JDK 17 to use instead of downloading one
#   ACCEPT_ANDROID_SDK_LICENSES=yes   accept the Android SDK licenses with no questions (for a run with no terminal).
#                Read them first: https://developer.android.com/studio/terms
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
TOOLS="${PLAY_TOOLS:-$REPO/play/.tools}"
PROJECT="${PLAY_PROJECT:-$HERE/android}"
PUBLIC="${PLAY_PUBLIC:-$REPO/public}"
KEYSTORE="${BUBBLEWRAP_KEYSTORE:-$HOME/.android/reelitin-upload.keystore}"
KEY_ALIAS="${BUBBLEWRAP_KEY_ALIAS:-reelitin}"
KEY_DNAME="${KEY_DNAME:-CN=Reel It In, O=Cottage Arcade, C=CA}"
CLI_VERSION="1.25.0"
BUILD_TOOLS="36.1.0"     # the version Bubblewrap 1.25.0 uses for zipalign and apksigner
BUILD_TOOLS_AGP="35.0.0" # the version that Android Gradle Plugin 8.9 asks for
PLATFORM="android-36"
CMDLINE_TOOLS="11076708" # Android command-line tools 12.0 (needs Java 17)
JDK_TAG="jdk-17.0.11+9"  # the JDK 17 that Bubblewrap itself pins; Bubblewrap rejects JDK 21

LOCAL=0
DEBUG_KEY=0
OUT="$HERE/dist"
while [ $# -gt 0 ]; do
  case "$1" in
    --local) LOCAL=1 ;;
    --debug-key) DEBUG_KEY=1 ;;
    --out) [ $# -ge 2 ] || { echo "build-aab: --out needs a folder" >&2; exit 2; }; OUT="$2"; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '\n== %s\n' "$*"; }
die() { printf 'build-aab: %s\n' "$*" >&2; exit 1; }
abspath() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
TOOLS="$(abspath "$TOOLS")"
PROJECT="$(abspath "$PROJECT")"
PUBLIC="$(abspath "$PUBLIC")"
OUT="$(abspath "$OUT")"

# ---------------- the signing key: where it is, and the rules for it (before anything is downloaded) ----------------
if [ "$DEBUG_KEY" = 1 ]; then
  KEYSTORE="$TOOLS/debug/reelitin-debug.keystore"
  KEY_ALIAS="reelitin-debug"
  # a throwaway key has a public password: it protects nothing
  export BUBBLEWRAP_KEYSTORE_PASSWORD="android" BUBBLEWRAP_KEY_PASSWORD="android"
else
  KEYSTORE="$(abspath "$KEYSTORE")"
  REAL_REPO="$(cd "$REPO" && pwd -P)"
  REAL_KS_DIR="$(cd "$(dirname "$KEYSTORE")" 2>/dev/null && pwd -P || true)"
  case "$KEYSTORE/" in "$REPO"/*) die "The keystore ($KEYSTORE) is inside the repository. Keep it outside git: set BUBBLEWRAP_KEYSTORE." ;; esac
  case "$REAL_KS_DIR/" in "$REAL_REPO"/*) die "The keystore ($KEYSTORE) is inside the repository. Keep it outside git: set BUBBLEWRAP_KEYSTORE." ;; esac
fi
# Bubblewrap puts the key path and the passwords inside double quotes in a shell command
case "$KEYSTORE$KEY_ALIAS" in *[\"\$\`\\]*|*$'\n'*) die "The keystore path and the alias must not contain \" \$ \` \\ or a line break." ;; esac
[[ "$KEY_ALIAS" =~ ^[A-Za-z0-9_.-]+$ ]] || die "The key alias may only have letters, digits, dot, underscore and dash."

# ---------------- node and java ----------------
command -v node >/dev/null || die "Node.js 18 or later is required. Install it from https://nodejs.org and run again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18 or later is required (you have $(node --version))."
command -v npm >/dev/null || die "npm is required (it comes with Node.js)."
command -v curl >/dev/null || die "curl is required."
command -v unzip >/dev/null || die "unzip is required."
# every value of the app comes from play/fish/twa-manifest.json
mf() { node -p 'String(require(process.argv[1])[process.argv[2]])' "$HERE/twa-manifest.json" "$1"; }
HOST="$(mf host)"; PKG="$(mf packageId)"; VNAME="$(mf appVersionName)"; VCODE="$(mf appVersionCode)"; MINSDK="$(mf minSdkVersion)"
TARGETSDK="$(node "$HERE/patch-android.mjs" --target-sdk)"
[[ "$VNAME" =~ ^[0-9A-Za-z._-]+$ ]] || die "appVersionName \"$VNAME\" may only have letters, digits, dot, underscore and dash."
[[ "$VCODE" =~ ^[0-9]+$ ]] || die "appVersionCode \"$VCODE\" is not a whole number."

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
# one private Gradle cache: deleting play/.tools removes everything this script downloaded
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$TOOLS/gradle-home}"
echo "Node $(node --version), $("$JDK/bin/java" -version 2>&1 | grep -m1 ' version ') at $JDK"

# ---------------- Bubblewrap CLI ----------------
CLI_DIR="$TOOLS/cli"
BW="$CLI_DIR/node_modules/@bubblewrap/cli/bin/bubblewrap.js"
if [ ! -f "$BW" ] || [ "$(node -p "require('$CLI_DIR/node_modules/@bubblewrap/cli/package.json').version")" != "$CLI_VERSION" ]; then
  say "Installing @bubblewrap/cli@$CLI_VERSION into $CLI_DIR"
  mkdir -p "$CLI_DIR"
  npm install --prefix "$CLI_DIR" --no-audit --no-fund --loglevel=error "@bubblewrap/cli@$CLI_VERSION"
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
BT="$SDK/build-tools/$BUILD_TOOLS"
if [ ! -x "$BT/apksigner" ] || [ ! -x "$BT/aapt2" ] || [ ! -d "$SDK/build-tools/$BUILD_TOOLS_AGP" ] || [ ! -f "$SDK/platforms/$PLATFORM/android.jar" ] || [ ! -d "$SDK/platform-tools" ]; then
  say "Installing Android build-tools $BUILD_TOOLS and $BUILD_TOOLS_AGP, $PLATFORM and platform-tools"
  PACKAGES=("build-tools;$BUILD_TOOLS" "build-tools;$BUILD_TOOLS_AGP" "platforms;$PLATFORM" "platform-tools")
  # These packages have a license that you must accept. sdkmanager asks about the licenses of the packages it installs, and no others.
  if [ "${ACCEPT_ANDROID_SDK_LICENSES:-}" = yes ]; then
    echo "ACCEPT_ANDROID_SDK_LICENSES=yes: accepting the license of these packages. sdkmanager prints the text to $TOOLS/sdkmanager.log."
    "$SDKMANAGER" --sdk_root="$SDK" "${PACKAGES[@]}" < <(yes) > "$TOOLS/sdkmanager.log" 2>&1 || { tail -20 "$TOOLS/sdkmanager.log" >&2; die "sdkmanager failed."; }
  elif [ -t 0 ]; then
    "$SDKMANAGER" --sdk_root="$SDK" "${PACKAGES[@]}"
  else
    die "Accept the Android SDK licenses: run this script in a terminal, or read them (https://developer.android.com/studio/terms) and set ACCEPT_ANDROID_SDK_LICENSES=yes."
  fi
  [ -x "$BT/apksigner" ] && [ -x "$BT/aapt2" ] && [ -f "$SDK/platforms/$PLATFORM/android.jar" ] || die "sdkmanager did not install the Android packages."
fi
export ANDROID_HOME="$SDK"

CONFIG="$TOOLS/bubblewrap-config.json"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ jdkPath: process.argv[2], androidSdkPath: process.argv[3] }))' "$CONFIG" "$JDK" "$SDK"

# ---------------- signing key ----------------
KEYTOOL="$JDK/bin/keytool"
ask() { # ask VAR "prompt": read a password without echo when a terminal is open
  if [ -z "${!1:-}" ]; then
    [ -t 0 ] || die "Set $1 (no terminal to ask for it)."
    read -r -s -p "$2: " "${1?}"; echo
    export "${1?}"
  fi
}
check_password() { # check_password VAR: the rules for a password (Bubblewrap passes it through a shell)
  local v="${!1}"
  [ ${#v} -ge 6 ] || die "The password must have 6 characters or more."
  case "$v" in *[\"\$\`\\]*|*$'\n'*) die "The password must not contain \" \$ \` \\ or a line break (Bubblewrap passes it through a shell)." ;; esac
}
if [ ! -f "$KEYSTORE" ]; then
  if [ "$DEBUG_KEY" = 1 ]; then
    say "Making a throwaway debug key at $KEYSTORE"
    mkdir -p "$(dirname "$KEYSTORE")"
    "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 3650 \
      -dname "CN=Reel It In DEBUG KEY - NEVER UPLOAD, O=Cottage Arcade, C=CA" -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD -keypass:env BUBBLEWRAP_KEY_PASSWORD
    chmod 600 "$KEYSTORE"
  else
    cat <<EOF

There is no upload key at $KEYSTORE yet.

What this key is:
  - You sign every bundle that you upload to Google Play with it. It proves that the bundle comes from you.
  - Google Play signs the app that players install with a second key that Google keeps (Play App Signing).
    Play shows you that key's SHA-256 fingerprint after your first upload.
What you must do with it:
  - Keep this file and its password in two safe places outside git, for example a password manager and an offline copy.
  - If you lose it, you cannot sign new bundles. Google lets you register a new upload key (UNCONFIRMED here:
    check the steps in the Play Console help before you rely on this).
  - Never put it in git, in a chat or in an e-mail. This script refuses a keystore inside the repository.
EOF
    [ -t 0 ] || die "Make the key in a terminal, or make it with keytool (see play/fish/README.md), then run this script again."
    read -r -p "Make the key now? [y/N] " ANSWER
    case "$ANSWER" in y|Y|yes|YES) ;; *) die "No upload key. Nothing was built." ;; esac
    if [ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ]; then
      read -r -s -p "New keystore password (6 characters or more, no \" \$ \` \\): " BUBBLEWRAP_KEYSTORE_PASSWORD; echo
      read -r -s -p "New keystore password again: " AGAIN; echo
      [ "$BUBBLEWRAP_KEYSTORE_PASSWORD" = "$AGAIN" ] || die "The two passwords differ."
      export BUBBLEWRAP_KEYSTORE_PASSWORD
    fi
    # a PKCS12 keystore has one password, so the key password is the same
    export BUBBLEWRAP_KEY_PASSWORD="${BUBBLEWRAP_KEY_PASSWORD:-$BUBBLEWRAP_KEYSTORE_PASSWORD}"
    [ "$BUBBLEWRAP_KEY_PASSWORD" = "$BUBBLEWRAP_KEYSTORE_PASSWORD" ] || die "A new PKCS12 keystore needs the same keystore and key password."
    check_password BUBBLEWRAP_KEYSTORE_PASSWORD
    say "Making the upload key at $KEYSTORE"
    mkdir -p "$(dirname "$KEYSTORE")"
    "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 20000 \
      -dname "$KEY_DNAME" -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD -keypass:env BUBBLEWRAP_KEY_PASSWORD
    chmod 600 "$KEYSTORE"
    echo "Made $KEYSTORE. Back it up now: copy the file to a second place that is not this computer, and keep the password with it."
  fi
fi
ask BUBBLEWRAP_KEYSTORE_PASSWORD "Keystore password"
# a PKCS12 keystore has one password, so the key password defaults to the keystore password
export BUBBLEWRAP_KEY_PASSWORD="${BUBBLEWRAP_KEY_PASSWORD:-$BUBBLEWRAP_KEYSTORE_PASSWORD}"
check_password BUBBLEWRAP_KEYSTORE_PASSWORD
check_password BUBBLEWRAP_KEY_PASSWORD
KEYINFO="$(LC_ALL=C "$KEYTOOL" -list -v -keystore "$KEYSTORE" -alias "$KEY_ALIAS" -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD 2>/dev/null)" \
  || die "Cannot open key \"$KEY_ALIAS\" in $KEYSTORE with that password."
if [ "$DEBUG_KEY" != 1 ]; then
  # Google Play rejects a bundle that is signed with a debug certificate, and this script's own debug key must never be an upload key
  grep -Eq 'Owner:.*(CN=Android Debug|NEVER UPLOAD)' <<<"$KEYINFO" && die "$KEYSTORE holds a debug key. Google Play rejects it. Use your upload key."
  BITS="$(sed -n 's/.*Subject Public Key Algorithm: *\([0-9]*\)-bit RSA key.*/\1/p' <<<"$KEYINFO" | head -1)"
  [ -z "$BITS" ] || [ "$BITS" -ge 2048 ] || die "The key has $BITS bits. Google Play needs RSA 2048 bits or more."
fi
SHA="$(sed -n 's/^[[:space:]]*SHA256: *//p' <<<"$KEYINFO" | head -1)"
[[ "$SHA" =~ ^([0-9A-F]{2}:){31}[0-9A-F]{2}$ ]] || die "Cannot read the SHA-256 fingerprint of the key."
if [ "$DEBUG_KEY" = 1 ]; then
  printf '\n!!!!  DEBUG KEY: this build is signed with a throwaway key. It can NEVER be uploaded to Google Play.  !!!!\n'
fi

# ---------------- the Android project ----------------
mkdir -p "$PROJECT"
MANIFEST="$PROJECT/twa-manifest.json"
SERVER_PID=""; WORK=""; GRADLE_RAN=0
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$WORK" ] && rm -rf "$WORK" || true
  # stop the Gradle daemon of this private Gradle home
  if [ "$GRADLE_RAN" = 1 ] && [ -x "$PROJECT/gradlew" ]; then (cd "$PROJECT" && ./gradlew --stop >/dev/null 2>&1) || true; fi
}
trap cleanup EXIT
WORK="$(mktemp -d)"
BASE=""
if [ "$LOCAL" = 1 ]; then
  # a tiny static server over the site files on a free port; it prints its port and runs until this script ends
  PORT_FILE="$WORK/port"
  node -e '
    const http = require("http"), fs = require("fs"), path = require("path");
    const root = path.resolve(process.argv[1]), types = { ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".html": "text/html" };
    const srv = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(new URL(q.url, "http://x").pathname));
      if (p !== root && !p.startsWith(root + path.sep)) { r.writeHead(403); return r.end(); }
      fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); r.end(b); });
    }).listen(0, "127.0.0.1", () => fs.writeFileSync(process.argv[2], String(srv.address().port)));
  ' "$PUBLIC" "$PORT_FILE" &
  SERVER_PID=$!
  for _ in $(seq 50); do [ -s "$PORT_FILE" ] && break; sleep 0.1; done
  [ -s "$PORT_FILE" ] || die "The local server did not start."
  BASE="http://127.0.0.1:$(cat "$PORT_FILE")"
  echo "Serving $PUBLIC at $BASE for the icons and the web manifest"
fi
# The project gets its own copy of twa-manifest.json: the signing key path filled in and, with --local, the download URLs
# pointed at the local server. The host and start URL stay the same, so the app opens the live site.
node -e '
  const fs = require("fs"), [src, dst, ks, alias, base] = process.argv.slice(1);
  const m = JSON.parse(fs.readFileSync(src, "utf8"));
  m.signingKey = { path: ks, alias };
  if (base) for (const k of ["iconUrl", "maskableIconUrl", "monochromeIconUrl", "webManifestUrl"]) if (m[k]) { const u = new URL(m[k]); m[k] = base + u.pathname; }
  fs.writeFileSync(dst, JSON.stringify(m, null, 2) + "\n");
' "$HERE/twa-manifest.json" "$MANIFEST" "$KEYSTORE" "$KEY_ALIAS" "$BASE"
# Bubblewrap fails late and with a poor message when a file is missing, so ask for each file first
for K in webManifestUrl iconUrl maskableIconUrl; do
  U="$(node -p 'require(process.argv[1])[process.argv[2]] || ""' "$MANIFEST" "$K")"
  [ -n "$U" ] || die "twa-manifest.json has no $K."
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 30 "$U" || true)"
  [ "$CODE" = 200 ] || die "$U answers HTTP $CODE ($K). Deploy the web files first, or add --local to take them from this checkout."
done

GRADLE_RAN=1
say "Generating the Android project in $PROJECT"
# update --skipVersionUpgrade regenerates the project from the manifest with no questions; versions come from twa-manifest.json
(cd "$PROJECT" && node "$BW" update --skipVersionUpgrade --manifest="$MANIFEST" --directory="$PROJECT" --config="$CONFIG")
if [ -n "$BASE" ]; then
  # the template also writes the web manifest URL into a string resource: point it back at the live host
  node -e 'const fs = require("fs"), [f, a, b] = process.argv.slice(1); fs.writeFileSync(f, fs.readFileSync(f, "utf8").split(a).join(b));' "$PROJECT/app/build.gradle" "$BASE" "https://$HOST"
fi
say "Applying the Google Play rules"
node "$HERE/patch-android.mjs" "$PROJECT"

say "Building and signing"
# an old output must never pass for the new one
rm -f "$PROJECT/app-release-signed.apk" "$PROJECT/app-release-bundle.aab" "$PROJECT/app-release-unsigned-aligned.apk"
# build sees an unchanged manifest checksum, so it keeps the patched project; the key comes from the project's twa-manifest.json
# and the passwords from the environment
# Maven Central sometimes answers HTTP 429 (too many requests) to a shared address, most often on a cold Gradle cache.
# Gradle keeps what it has downloaded, so each try gets further. Wait a little between the tries.
TRIES=4
BUILT=0
for TRY in $(seq "$TRIES"); do
  if (cd "$PROJECT" && node "$BW" build --manifest="$MANIFEST" --directory="$PROJECT" --config="$CONFIG"); then BUILT=1; break; fi
  [ "$TRY" = "$TRIES" ] || { say "The build failed. Trying again ($((TRY + 1)) of $TRIES) in 10 s. If it keeps failing for the same reason, read the first error above."; sleep 10; }
done
[ "$BUILT" = 1 ] || die "The build failed $TRIES times. Read the first error above."
APK_BUILT="$PROJECT/app-release-signed.apk"
AAB_BUILT="$PROJECT/app-release-bundle.aab"
[ -f "$APK_BUILT" ] || die "No signed APK at $APK_BUILT."
[ -f "$AAB_BUILT" ] || die "No signed bundle at $AAB_BUILT."

# ---------------- copy the outputs ----------------
NAME="reelitin-$VNAME-$VCODE"; [ "$DEBUG_KEY" = 1 ] && NAME="$NAME-DEBUGKEY"
mkdir -p "$OUT"
APK="$OUT/$NAME.apk"; AAB="$OUT/$NAME.aab"; FPFILE="$OUT/$NAME.fingerprint.txt"
cp "$APK_BUILT" "$APK"; cp "$AAB_BUILT" "$AAB"

# ---------------- verify ----------------
say "Checking the APK"
"$BT/aapt2" dump badging "$APK" > "$WORK/badging.txt"
"$BT/aapt2" dump resources "$APK" > "$WORK/resources.txt"
unzip -p "$AAB" base/manifest/AndroidManifest.xml > "$WORK/aab-manifest.bin" || die "$AAB has no base/manifest/AndroidManifest.xml."
node "$HERE/verify-output.mjs" "$WORK/badging.txt" "$WORK/resources.txt" "$WORK/aab-manifest.bin" --twa "$HERE/twa-manifest.json" --target-sdk "$TARGETSDK"
# the minimum SDK of the app is 24, so ask apksigner to check as a device with that level would (v2 and v3 signatures)
APKSIG="$("$BT/apksigner" verify --verbose --print-certs --min-sdk-version "$MINSDK" "$APK")" || die "apksigner cannot verify $APK."
grep -q "v2 scheme (APK Signature Scheme v2): true" <<<"$APKSIG" || die "$APK has no v2 signature."
APK_SHA="$(sed -n 's/^Signer #1 certificate SHA-256 digest: *//p' <<<"$APKSIG" | head -1)"
norm() { printf '%s' "$1" | tr -d ': \n' | tr 'A-F' 'a-f'; }
[ "$(norm "$APK_SHA")" = "$(norm "$SHA")" ] || die "The APK is signed with another key than the keystore."
echo "The APK verifies (apksigner, --min-sdk-version $MINSDK) and is signed with the key in the keystore."

say "Checking the bundle"
JARV="$("$JDK/bin/jarsigner" -verify "$AAB" 2>&1)" || die "jarsigner cannot verify $AAB."
grep -q "jar verified" <<<"$JARV" || die "jarsigner did not say \"jar verified\" for $AAB."
AAB_SHA="$(LC_ALL=C "$KEYTOOL" -printcert -jarfile "$AAB" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: *//p' | head -1)"
[ "$(norm "$AAB_SHA")" = "$(norm "$SHA")" ] || die "The bundle is signed with another key than the keystore."
echo "The bundle verifies (jarsigner) and is signed with the key in the keystore."

printf '%s\n' "$SHA" > "$FPFILE"
size() { wc -c < "$1" | tr -d ' '; }

# ---------------- what to do next ----------------
say "Done"
echo "Bundle (for Play Console): $AAB ($(size "$AAB") bytes)"
echo "APK (for adb):             $APK ($(size "$APK") bytes)"
echo "Fingerprint file:          $FPFILE"
if [ "$DEBUG_KEY" = 1 ]; then
  printf '\n!!!!  DEBUG KEY: do NOT upload %s to Google Play. It is for adb and for tests only.  !!!!\n' "$NAME.aab"
  echo "SHA-256 fingerprint of the debug key (adb installs only):"
else
  echo "SHA-256 fingerprint of your upload key:"
fi
echo "  $SHA"
echo
if [ "$DEBUG_KEY" != 1 ]; then
  echo "1. Put the fingerprint in public/.well-known/assetlinks.json:  node play/fish/assetlinks.mjs --upload \"$SHA\""
  echo "2. Deploy the site, then check it:  node play/fish/assetlinks.mjs --check"
  echo "3. Upload $AAB to the internal testing track in Play Console."
  echo "4. After that upload, copy the Play app signing SHA-256 from Play Console and run:  node play/fish/assetlinks.mjs --play <SHA-256>"
fi
echo "Install:  $SDK/platform-tools/adb install -r \"$APK\""
echo "Watch:    $SDK/platform-tools/adb logcat | grep -i -e OriginVerifier -e digital_asset_links -e TWA"
