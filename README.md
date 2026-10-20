# SANAD Prototype (Sprint 3)

Functional, clickable React Native prototype of **SANAD**, an on-demand car services app for drivers in Qatar, built for 67-443 Mobile Applications (CMU-Q).

Team Sanad: Nasser Al-Ejail (nejail), Hassan Al-Qassabi (haq), Mohammed Al-Marri (mrmarri)

The screens follow the revised high-fidelity Figma file. The prototype is also used to test whether the key technologies SANAD depends on work on real devices.

## Run it

Requirements: Node 20+, and either the **Expo Go** app on your phone or the iOS Simulator.

```bash
npm install
npx expo start
```

Then scan the QR code with the camera (iPhone) or Expo Go (Android), or press `i` for the iOS Simulator.

The project uses **Expo SDK 57** (React Native 0.86), the same SDK as the course labs, so it opens in Expo Go 57. GPS, camera and notifications are best tested on a physical phone.

Other commands:

```bash
npm test            # 52 unit tests (pricing, OTP rules, validation, tracking, API JSON parsing, Firestore mapping)
npm run typecheck   # TypeScript strict mode
npx expo start --web  # browser preview (maps, secure store, haptics are stubbed)
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
| Show location and provider | `react-native-maps` | Yes | Real (Apple Maps on iOS, Google Maps on Android) | Google Maps API key for Android store builds |
| Photo of the car | `expo-image-picker` (camera + library) | Yes | Real | Upload to cloud storage with the order |
| Order and OTP alerts | `expo-notifications` (local) | Yes | Real local notifications | Remote push needs a development build, APNs/FCM and a push server |
| Keep the user signed in | `expo-secure-store` | Yes | Real (Keychain / Keystore) | Store a server-issued session token |
| Cars, addresses, orders offline | `@react-native-async-storage/async-storage` | Yes | Real | Cache of backend data |
| Secure sign in | OTP rules in `src/models/otp.ts` | n/a | Simulated: code generated on device | Server-side OTP (e.g. Twilio Verify or Supabase phone auth) so the code never exists on the phone |
| Contact provider / SOS | `Linking` (`tel:`, WhatsApp link) | Yes | Real | Masked numbers through a calling provider |
| Nearby providers and garages | Nominatim search API, with Overpass asked in parallel (OpenStreetMap JSON) | Yes | Real API, JSON parsed in `src/api/osm.ts`; Nominatim answers on device, Overpass timed out from Qatar | Self-hosted service or Google Places |
| Road distance, ETA, route | OSRM route API (JSON) | Yes | Real API, JSON parsed in `src/api/osm.ts` | Self-hosted OSRM or Google Routes |
| Backend data | Cloud Firestore (structure in `src/models/firestore.ts`, rules in `firebase/firestore.rules`) | Needs dev build | Structure and converters defined | Next sprint |
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
src/feasibility/tests.ts     the in-app technology tests
firebase/firestore.rules     draft security rules
docs/                        data mapping, feasibility results, user test plan, feature schedule
__tests__/                   Jest unit tests
```

## Known limitations

- No backend yet: data lives on the device, the technician and their speed are simulated (their starting business and road route are real), and the OTP is generated locally.
- The public Overpass and OSRM servers are for light use; the app falls back to estimates when they are unreachable.
- Card payment and promo codes are placeholders.
- The browser preview cannot show maps, secure storage, haptics or reverse geocoding; use a phone or simulator.
