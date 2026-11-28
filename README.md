# SANAD (Sprint 4: first version)

React Native app for **SANAD**, an on-demand car services app for drivers in Qatar, built for 67-443 Mobile Applications (CMU-Q).

Team Sanad: Nasser Al-Ejail (nejail), Hassan Al-Qassabi (haq), Mohammed Al-Marri (mrmarri)

The screens follow the revised high-fidelity Figma file. Sprint 4 adds real SMS sign-in with Firebase Authentication, which runs in a development build.

## Run it

Requirements: Node 20+, a Mac with Xcode for the development build, and an iPhone or the iOS Simulator. The project uses **Expo SDK 58** (React Native 0.88), the version the current Expo Go app supports.

| Mode | Command | Sign-in |
|---|---|---|
| Development build (full app) | `npm run prebuild` then `npm run ios:device` (first time), later `npx expo start` | Real SMS through Firebase Authentication |
| Expo Go (quick UI work) | `npm run go` | Prototype code shown as a notification |

The development build needs `GoogleService-Info.plist` in the project root (shared privately, not committed). Full setup, including a free Apple ID: [docs/firebase-setup.md](docs/firebase-setup.md).

Other commands:

```bash
npm test            # unit tests (auth, pricing, OTP rules, validation, tracking, API JSON parsing, Firestore mapping, repository and catalogue)
npm run seed:services -- --dry-run   # preview the Firestore service catalogue (see docs/firestore-data.md)
npm run typecheck   # TypeScript strict mode
npx expo start --web  # browser preview (maps, secure store, haptics, Firebase are stubbed)
```

Sprint 4 task prompts for teammates: [docs/prompts](docs/prompts).

## Version 2 (after Sprint 5 user testing)

Nasser's Version 2 features: the tow price shows the distance from the first price screen, a large **Enter Location Manually** button appears when GPS fails, the SMS wait is explained, new drivers can **Skip for now** on Add Car, Track Order shows a clear **Accepted** step with the technician's details and a **Demo Mode** badge, and **Provider Mode** (Profile) lets a technician accept a job and update its status. The driver gets in-app notifications when the technician accepts, sets off and arrives, and the car photo is uploaded to Cloud Storage.

Not working yet:

- **Push notifications with the app closed** are coded but not set up: they need an EAS project id (`npx eas init`) and, on iOS, a paid Apple Developer account. Without them no push is sent.
- **Android:** the app code is shared with iOS and the map needs no API key (Leaflet with OpenStreetMap), but Android is not built or tested on a phone yet. It needs an EAS project (`npx eas init`) or Android Studio to build it, and an Android app in Firebase with `google-services.json` and signing fingerprints for SMS sign-in. See [docs/android-build.md](docs/android-build.md).

Hassan's Version 2 features: orders are saved in Firestore and follow the technician live on the driver's phone, each new order is offered to the **nearest online technician** (by road) and moves to the next one after 2 minutes, the van on Track Order follows the **technician's live location**, and finished orders have **Book again**. Drivers can **rate the technician** after a finished job (stars and an optional comment), and the rating shown is the average of those reviews. The technician's phone keeps sharing its location while the app is open on any screen. See [docs/version-2.md](docs/version-2.md#hassans-features-5-7-8-9-14-15).

Verified so far (25 and 28 Nov 2026):

- `firebase/firestore.rules` and `firebase/storage.rules` are published, and all 32 rules checks pass in the Firestore emulator.
- The six `services` documents are in Firestore (`npm run seed:services -- --key ...`).
- Three-phone test on 28 Nov (one driver, two registered technicians, iOS Release build): orders in Firestore, nearest-technician matching and moving the offer on, live location, ratings and car photo upload all worked (orders SND-1043-VQHV to SND-1046-VQHV). Details in [docs/version-2.md](docs/version-2.md#results-25-and-28-nov-2026).

Not verified yet:

- A price changed in the console showing in the app after relaunch (feature 9), and Book again (feature 15) on a phone.
- Live location stops when the technician's phone is locked or SANAD is in the background (foreground only for now).
- The 25 Nov fixes (**Find on Map** for typed locations, push and alert changes, the Android map) were not part of the three-phone test build.

```bash
npm run add:provider -- --phone 55550123 --name "Ahmed" --dry-run   # register a technician for Provider Mode (admin)
npm run build:android                                                # Android development build with EAS
```

## Demo script

| Step | What to do | What it shows |
|---|---|---|
| 1 | Open the app | Splash for 2 seconds, then it moves on automatically |
| 2 | Sign in with **5012 3456** | OTP is "sent" as a notification (SMS stand-in) |
| 3 | Enter the 6-digit code shown in the notification | Returning user lands on **Home with registered cars loaded** |
| 4 | Tap any service, e.g. **Emergency 24/7 > Towing** | Options, price breakdown with 5% VAT, optional photo |
| 5 | Select Vehicle > Location > **Use My Current Location** | Live GPS, reverse geocoded address, real map |
| 6 | Schedule > Review Order | Nearest real garage (OpenStreetMap via Nominatim/Overpass) with road distance and ETA (OSRM API); for towing, pick the garage to tow to and the price uses the road distance |
| 7 | Place Order > Track Order | Provider drives towards you along the real road route, status and ETA update, notifications fire |
| 8 | Close and reopen the app | Session is restored from secure storage, no second sign in |
| 9 | Profile > Logout, then sign in with any other number (e.g. 6655 4433) | No account found > add name > **Add Your First Car** > Home |
| 10 | Profile > **Technology Feasibility Tests** > Run Automatic Tests > Share Results | Pass/fail, timing and device details for each technology |

Wrong codes show the attempts left; codes expire after 5 minutes; resend is available after 30 seconds.

## Screens

Splash, Sign In, Register, Verify OTP, Add First Car, Home, six service screens (Battery, Fuel Delivery, Car Wash, Tire Service, Oil Change, Emergency 24/7), Select Vehicle, Add Car, Location, Schedule, Review Order, Order Placed, Track Order, My Cars, My Orders, Profile, My Addresses, Add Address, Feasibility Tests.

## Key technologies

| Need in SANAD | Technology | Expo Go | Status in prototype | Production path |
|---|---|---|---|---|
| Find the driver | `expo-location` (GPS + reverse geocoding) | Yes | Real | Same; add background updates only if needed |
| Show location and provider | `react-native-maps` on iOS, Leaflet in `react-native-webview` on Android | Yes | Real on iOS (Apple Maps); OpenStreetMap on Android, not tried on a phone yet | Own or paid tile server on Android (the public OpenStreetMap tiles are for light use) |
| Photo of the car | `expo-image-picker` (camera + library) | Yes | Real | Upload to cloud storage with the order |
| Order and OTP alerts | `expo-notifications` (local) | Yes | Real local notifications | Remote push needs a development build, APNs/FCM and a push server |
| Keep the user signed in | `expo-secure-store` | Yes | Real (Keychain / Keystore) | Store a server-issued session token |
| Cars, addresses, orders offline | `@react-native-async-storage/async-storage` | Yes | Real | Cache of backend data |
| Secure sign in | Firebase Authentication (phone) via React Native Firebase, `src/services/auth.ts` | Needs dev build | Real SMS in the development build; prototype OTP rules (`src/models/otp.ts`) as the Expo Go fallback | Same; free plan allows 10 SMS a day, billing raises it |
| Contact provider / SOS | `Linking` (`tel:`, WhatsApp link) | Yes | Real | Masked numbers through a calling provider |
| Nearby providers and garages | Nominatim search API, with Overpass asked in parallel (OpenStreetMap JSON) | Yes | Real API, JSON parsed in `src/api/osm.ts`; Nominatim answers on device, Overpass timed out from Qatar | Self-hosted service or Google Places |
| Road distance, ETA, route | OSRM route API (JSON) | Yes | Real API, JSON parsed in `src/api/osm.ts` | Self-hosted OSRM or Google Routes |
| Account data and orders | Cloud Firestore `users/{uid}` with `cars` and `addresses` (`src/services/firestoreRepo.ts`), `orders/{id}` (`src/services/ordersRepo.ts`) | Needs dev build | Real in the development build: live sync, offline cache, security rules; AsyncStorage in Expo Go | Same |
| Service catalogue | Cloud Firestore `services` (`src/services/catalogRepo.ts`) | Needs dev build | Real: prices editable in the console, built-in fallback | Same |
| Navigation | React Navigation (native stack + bottom tabs) | Yes | Real | Same |
| Provider matching and live tracking | Firestore `providers` + OSRM (`src/services/matching.ts`), `orders/{id}/tracking/live` (`src/services/trackingRepo.ts`) | Needs dev build | Real in the development build: nearest online technician by road, live location every few seconds; simulated in Expo Go | Same, plus a server to re-offer jobs when the driver's app is closed |

## Project structure (MVVM, like the course labs)

```
App.tsx                      providers + navigator
src/models/                  types, service catalogue, pricing, OTP rules, validation, tracking, demo data
src/services/                device APIs: location, notifications, media, secure session, storage, contact
src/viewModels/AppContext.tsx  app state (auth, account, booking draft) and actions
src/views/                   screens (auth, home, booking, orders, cars, profile)
src/components/              shared UI (buttons, cards, option rows, map, logo)
src/api/osm.ts               external APIs (Overpass, OSRM) and JSON parsing
src/models/firestore.ts      Firebase structure and converters
src/services/firestoreRepo.ts  users, cars and addresses in Firestore (load, save, live updates)
src/services/catalogRepo.ts  service catalogue from Firestore with built-in fallback
src/services/providerRepo.ts  Provider Mode: open jobs, accept, status updates in Firestore
src/services/photoUpload.ts  car photo upload to Cloud Storage
src/services/push.ts         push token and push messages for order status
src/views/provider/          Provider Mode screens (jobs list, job)
scripts/seed-services.ts     seeds the services collection (admin)
scripts/add-provider.ts      registers a technician in the providers collection (admin)
src/feasibility/tests.ts     the in-app technology tests
firebase/firestore.rules     Firestore security rules (publish in the Firebase console)
firebase/storage.rules       Cloud Storage rules for car photos
docs/                        Firebase setup, Firestore data, data mapping, feasibility results, user test plan, feature schedule
__tests__/                   Jest unit tests
```

## Known limitations

- Expo Go has no Firebase: there the OTP is generated locally and data stays on the phone. In the development build, sign-in, profile, cars, addresses and the service catalogue use Firebase.
- In Expo Go, orders stay on the phone: a technician accepts them in Provider Mode on the same phone, or the technician is simulated, and the van's movement is simulated (Demo Mode). In the development build, orders go to the nearest online technician when there is one; with nobody online the simulated technician takes the job.
- Moving a job to the next technician after 2 minutes runs on the driver's phone, so it only happens while SANAD is open there.
- The public Overpass and OSRM servers are for light use; the app falls back to estimates when they are unreachable.
- Card payment and promo codes are placeholders.
- The browser preview cannot show maps, secure storage, haptics or reverse geocoding; use a phone or simulator.
