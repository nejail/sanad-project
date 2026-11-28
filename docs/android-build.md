# Android Build (Version 2, feature 16)

Many drivers in Qatar use Android. The app code is shared with iOS. No Google Maps API key is needed: on Android the map is Leaflet with OpenStreetMap tiles in a WebView (`src/components/MapPreview.android.tsx`).

**Status (28 Nov 2026):** Firebase is set up for Android (step 1, including the Play Integrity API). A release APK (version 0.5.0) built with the command-line steps in 2c was tested on an Android 16 emulator (Pixel 7 profile): Firebase sign-in with the test number, then normal booking with GPS, GPS off with Find on Map, and Book again, with orders saved to Firestore (SND-1043-JINW to SND-1045-JINW) and no crashes. On the emulator Play Integrity fails, so Firebase falls back to a reCAPTCHA check in Chrome, which passed. Not done yet: a test on a physical Android phone.

## 1. Add the Android app to Firebase (once)

1. Firebase console > Project settings > **Add app > Android**. Package name: `qa.cmu.sanad.prototype` (must match `app.json`). Nickname: `SANAD Android`.
2. Download **google-services.json** into the project root, next to `GoogleService-Info.plist`. Like the iOS file it is **not committed**; share it with the team privately.
3. Phone sign-in on Android checks the app's signing certificate, so add its fingerprints under Project settings > Your apps > SANAD Android > **Add fingerprint**:
   - **EAS build:** run `npx eas credentials -p android`, choose the development profile, and copy the SHA-1 and SHA-256.
   - **Local build:** `cd android && ./gradlew signingReport` after step 2 below, and copy the SHA-1 and SHA-256 of the `debug` variant.

   Without the fingerprints, the SMS code is refused with `auth/app-not-authorized` (or a reCAPTCHA page opens instead).
4. In Google Cloud console (project `sanad-9d5f6`) > APIs & Services > Library, enable the **Play Integrity API**. Without it and the fingerprints, sending a code fails with `auth/missing-client-identifier`.
5. Phone numbers for testing (Authentication > Sign-in method > Phone) must include `+974 5012 3456` with code `123456`; otherwise a real SMS goes to that number.

The fingerprints registered on 28 Nov are those of `android/app/debug.keystore`, which signs local builds (SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`). An EAS build is signed with a different key, whose fingerprints must be added too.

`app.config.ts` adds Firebase to the Android build only when `google-services.json` is present. Without it the Android build still runs, in the same prototype mode as Expo Go (code shown on the phone, data kept on the phone).

## 2a. Build in the cloud with EAS (no Android Studio needed)

```bash
npm install
npx eas login                # the team's Expo account
npm run build:android        # eas build -p android --profile development
```

EAS uploads the project, including `google-services.json` if it is in the folder, and gives a link and QR code for the APK when it finishes. Open the link on the Android phone, install the APK (allow "install unknown apps" for the browser), then start the bundler on the laptop with `npm start` and open the project from the development build.

The `preview` profile (`npx eas build -p android --profile preview`) builds a standalone APK that does not need the laptop, for user testing.

## 2b. Build locally (Android Studio)

Requirements: Android Studio with an SDK and a JDK 17, and a phone with USB debugging on (or an emulator).

```bash
npm install
npm run prebuild:android     # generates the android/ folder (with Firebase when google-services.json is present)
npm run android:device       # pick the phone; builds and installs the development build
```

## 2c. Build a standalone APK from the command line (no Android Studio)

This is how the 28 Nov build was made on a Mac. It needs Homebrew.

```bash
brew install openjdk@17
brew install --cask android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;37.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
npm install
npx expo prebuild --platform android --clean
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleRelease
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`. Install it with `adb install` or by copying it to the phone. Three settings in `app.config.ts` make this build work: Kotlin 2.4.0 (Firebase's Android libraries need it), an R8 rule that keeps WorkManager's database class (without it the release build crashed at start), and more Gradle memory (`-Xmx6g -XX:MaxMetaspaceSize=2g`; with Firebase, R8 ran out of Metaspace under the default).

To try it on an emulator, also install `"emulator"` and `"system-images;android-36;google_apis;arm64-v8a"`, create one with `avdmanager create avd -n sanad -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7`, and start it with `$ANDROID_HOME/emulator/emulator -avd sanad`.

## 3. Check it works

| Check | Expected |
|---|---|
| Sign in with a real number | SMS code arrives; on many Android phones it fills in automatically |
| Sign in with the test number `+974 5012 3456`, code `123456` | Home with the demo cars |
| Profile > Technology Feasibility Tests > Run all | GPS, camera, notifications and Firestore pass |
| Book a jump start, open Track Order | Map, route, Demo Mode badge, notifications on accept and arrival |
| Profile > Provider Mode | Same as on iPhone |

## Android notes

- **Map:** Leaflet 1.9.4 is stored in the app (`src/components/leafletAssets.ts`), so tapping the map works without a network, but the map pictures need one. They come from the public OpenStreetMap servers, which are for light use, and show place names in Arabic in most of Qatar.
- Notifications use the `SANAD updates` channel (high importance), created at start-up in `src/services/notifications.ts`. Android 13 and later ask for notification permission on Home.
- Remote push on Android needs Firebase Cloud Messaging credentials uploaded to EAS (`npx eas credentials -p android` > Push Notifications). No paid account is needed, unlike iOS.
- The iOS-only `LSApplicationQueriesSchemes` in `app.json` has no Android equivalent to set: Call and WhatsApp open with `Linking.openURL`, which works without extra permissions.
