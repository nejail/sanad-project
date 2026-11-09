# Firebase and Development Build Setup (Sprint 4)

SANAD now signs users in with real SMS codes through **Firebase Authentication**. Firebase uses native code, so the app runs from a **development build** instead of Expo Go. Expo Go still works for screens that do not need Firebase: sign-in falls back to the Sprint 3 prototype code.

| How you open the app | Sign-in | Firestore |
|---|---|---|
| Development build (`npm run ios:device`) | Real SMS via Firebase | Available |
| Expo Go (`npm run go`) | Prototype code shown as a notification | Not available (local storage only) |

## 1. Create the Firebase project (once, by one person)

Use a **new project for SANAD**, not a lab project, so its data, security rules and usage limits stay separate.

1. Go to <https://console.firebase.google.com>, click **Create a project**, name it `SANAD`. Google Analytics is not needed.
2. **Add app > iOS**. Bundle ID: `qa.cmu.sanad.prototype` (must match `app.json`). App nickname: `SANAD iOS`. Skip the remaining steps in the wizard.
3. Download **GoogleService-Info.plist** and put it in the project root, next to `package.json`.
4. Optional, for Android: **Add app > Android**, package `qa.cmu.sanad.prototype`, download **google-services.json** into the project root.
5. **Build > Authentication > Get started > Sign-in method > Phone > Enable**.
6. Under **Phone numbers for testing**, add `+974 5012 3456` with code `123456` (the demo account). Test numbers never send an SMS and have no cost.
7. **Build > Firestore Database > Create database**, location Doha (`me-central1`) if it is listed, otherwise the closest available, start in **production mode**. Hassan publishes the rules from `firebase/firestore.rules`.

The two config files are **not committed** (the repo is public). Share them with the team privately, for example in the team chat.

### Real SMS and billing

Firebase sends real SMS only on the **Blaze (pay as you go)** plan. The test number above works without real SMS. If the team wants real SMS for the demo, upgrade to Blaze and set a small **budget alert** (for example 5 USD) in Google Cloud Billing first. Each SMS to Qatar is charged per message.

## 2. Build and install on an iPhone with a free Apple ID

Requirements: a Mac with Xcode (latest), CocoaPods (`brew install cocoapods`), the iPhone connected by cable, and Developer Mode on the iPhone (Settings > Privacy & Security > Developer Mode).

```bash
npm install
npm run prebuild        # generates the ios/ folder with Firebase (needs GoogleService-Info.plist)
npm run ios:device      # pick your iPhone; builds and installs the SANAD development build
```

If Xcode asks for signing:

1. Open `ios/SANAD.xcworkspace` in Xcode.
2. Select the **SANAD** target > **Signing & Capabilities** > **Team** > add your Apple ID (Personal Team).
3. If the bundle ID is taken, change it to something unique such as `qa.cmu.sanad.nejail` in Xcode **and** in `app.json`, and register the same ID as a second iOS app in Firebase.
4. On the iPhone: **Settings > General > VPN & Device Management** > trust your developer certificate.

Free Apple ID builds expire after **7 days**; run `npm run ios:device` again to reinstall. Push notifications (APNs) are not available on a free account, so Firebase verifies the phone with a short reCAPTCHA page instead of a silent push. That is expected.

After the first install you only need `npx expo start` and the development build reconnects to Metro, like Expo Go.

## 3. Check it works

1. Open the SANAD development build and sign in with **5012 3456**.
2. The OTP screen says **Secured by Firebase Authentication**. Enter **123456** (test number) or the code from the SMS.
3. **Profile > Technology Feasibility Tests > Firebase phone sign-in** shows the project id and the signed-in number.
4. In the Firebase console, **Authentication > Users** lists the user with the +974 number.

## Troubleshooting

| Message | Fix |
|---|---|
| `RNFBAppModule not found` | You opened the app in Expo Go or an old build. Run `npm run prebuild` and `npm run ios:device` again. |
| "Phone sign-in is not enabled" | Enable the Phone provider (step 1.5). |
| "Real SMS needs the Firebase Blaze plan" | Use the test number or upgrade to Blaze (see above). |
| Build fails after adding the plist | `npm run prebuild` (it uses `--clean`) and build again. |
| App opens Expo Go instead of the build | Use `npx expo start` (development build) or `npm run go` (Expo Go) explicitly. |
