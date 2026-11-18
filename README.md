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
| Show location and provider | `react-native-maps` | Yes | Real (Apple Maps on iOS, Google Maps on Android) | Google Maps API key for Android store builds |
| Photo of the car | `expo-image-picker` (camera + library) | Yes | Real | Upload to cloud storage with the order |
| Order and OTP alerts | `expo-notifications` (local) | Yes | Real local notifications | Remote push needs a development build, APNs/FCM and a push server |
| Keep the user signed in | `expo-secure-store` | Yes | Real (Keychain / Keystore) | Store a server-issued session token |
| Cars, addresses, orders offline | `@react-native-async-storage/async-storage` | Yes | Real | Cache of backend data |
| Secure sign in | Firebase Authentication (phone) via React Native Firebase, `src/services/auth.ts` | Needs dev build | Real SMS in the development build; prototype OTP rules (`src/models/otp.ts`) as the Expo Go fallback | Same; free plan allows 10 SMS a day, billing raises it |
| Contact provider / SOS | `Linking` (`tel:`, WhatsApp link) | Yes | Real | Masked numbers through a calling provider |
| Nearby providers and garages | Nominatim search API, with Overpass asked in parallel (OpenStreetMap JSON) | Yes | Real API, JSON parsed in `src/api/osm.ts`; Nominatim answers on device, Overpass timed out from Qatar | Self-hosted service or Google Places |
| Road distance, ETA, route | OSRM route API (JSON) | Yes | Real API, JSON parsed in `src/api/osm.ts` | Self-hosted OSRM or Google Routes |
| Account data | Cloud Firestore `users/{uid}` with `cars` and `addresses` (`src/services/firestoreRepo.ts`) | Needs dev build | Real in the development build: live sync, offline cache, security rules; AsyncStorage in Expo Go | Orders move to Firestore in Sprint 5 |
| Service catalogue | Cloud Firestore `services` (`src/services/catalogRepo.ts`) | Needs dev build | Real: prices editable in the console, built-in fallback | Same |
| Navigation | React Navigation (native stack + bottom tabs) | Yes | Real | Same |
| Provider matching and live tracking | Overpass + OSRM | n/a | Real nearest business and road route; movement sped up | `orders/{id}/tracking/live` written by the provider app |

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
scripts/seed-services.ts     seeds the services collection (admin)
src/feasibility/tests.ts     the in-app technology tests
firebase/firestore.rules     security rules (publish in the Firebase console)
docs/                        Firebase setup, Firestore data, data mapping, feasibility results, user test plan, feature schedule
__tests__/                   Jest unit tests
```

## Known limitations

- Expo Go has no Firebase: there the OTP is generated locally and data stays on the phone. In the development build, sign-in, profile, cars, addresses and the service catalogue use Firebase.
- Orders are still saved on the phone until Sprint 5; the technician and their speed are simulated (their starting business and road route are real).
- The public Overpass and OSRM servers are for light use; the app falls back to estimates when they are unreachable.
- Card payment and promo codes are placeholders.
- The browser preview cannot show maps, secure storage, haptics or reverse geocoding; use a phone or simulator.
