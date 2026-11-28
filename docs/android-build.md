# Android Build (Version 2, feature 16)

Many drivers in Qatar use Android. The app code is shared with iOS, but **the Android build has not been made or tested on a phone yet**. It needs an EAS project (`npx eas init`) or Android Studio, and the Firebase setup below for SMS sign-in. No Google Maps API key is needed: on Android the map is Leaflet with OpenStreetMap tiles in a WebView (`src/components/MapPreview.android.tsx`). The steps below cover Firebase and building the APK.

## 1. Add the Android app to Firebase (once)

1. Firebase console > Project settings > **Add app > Android**. Package name: `qa.cmu.sanad.prototype` (must match `app.json`). Nickname: `SANAD Android`.
2. Download **google-services.json** into the project root, next to `GoogleService-Info.plist`. Like the iOS file it is **not committed**; share it with the team privately.
3. Phone sign-in on Android checks the app's signing certificate, so add its fingerprints under Project settings > Your apps > SANAD Android > **Add fingerprint**:
   - **EAS build:** run `npx eas credentials -p android`, choose the development profile, and copy the SHA-1 and SHA-256.
   - **Local build:** `cd android && ./gradlew signingReport` after step 2 below, and copy the SHA-1 and SHA-256 of the `debug` variant.

   Without the fingerprints, the SMS code is refused with `auth/app-not-authorized` (or a reCAPTCHA page opens instead).

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
npm run prebuild:android     # generates the android/ folder with Firebase (needs google-services.json)
npm run android:device       # pick the phone; builds and installs the development build
```

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
