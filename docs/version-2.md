# Version 2 (after Sprint 5 user testing)

These are the Version 2 features owned by Nasser in the Sprint 5 report (section 6), in priority order. Each one names the screen it changes and how to check it. Unit tests for all of them are in `__tests__/version2.test.ts` and `__tests__/providerJobs.test.ts`.

| # | Feature | Level | Where | How to check |
|---|---|---|---|---|
| 1 | Tow price as base fee plus estimated distance from the first price screen | A | `ServiceView`, `useNearestGarage`, `towPriceExplanation` in `pricing.ts` | Emergency 24/7 > Towing: "How the tow price works" shows 200 QAR + the distance to the nearest garage, and the price card says **Estimated total** with the distance line. Review Order shows the same price. |
| 2 | Prominent "Enter Location Manually" button when GPS fails | A | `LocationView` | Turn Location Services off, start any service: a red message and a large **Enter Location Manually** button appear at the top; it opens the "Where is your car?" field. **Find on Map** drops a pin for the typed place to check before continuing; a place that is not found asks for a tap on the map (try `Salwa Road exit 12, by the petrol station` and `xyzxyz`). |
| 3 | Explain the SMS wait, keeping the Resend countdown | A | `VerifyOtpView`, `smsWaitHint` in `otp.ts` | Development build sign-in: "Your code is on its way… usually arrives within a minute"; after 45 s it changes to tips (check the number, signal, Resend). |
| 4 | Provider side: accept an order and update its status | A | `views/provider/*`, `useProviderJobs`, `providerRepo.ts`, `providerJobs.ts`, `scripts/add-provider.ts`, rules | See "Provider Mode" below. |
| 6 | Clear "Accepted" confirmation with verified technician details | A | `TrackOrderView`, `tracking.ts` | Track Order goes Requested > **Accepted** > On the way > Arrived > Done. While waiting it says "Not accepted yet"; on acceptance a green "Accepted by …" card shows the time, and the technician card shows vehicle, plate and **Verified technician**. |
| 10 | "Demo Mode" badge on Track Order until live tracking is ready | B | `TrackOrderView`, `showsDemoBadge` | An orange **DEMO MODE** badge next to SOS, and a matching note at the bottom. Set `LIVE_TRACKING_READY` in `tracking.ts` to `true` when feature 7 lands. |
| 11 | "Skip for now" on Add Your First Car | B | `AddCarView`, `RootNavigator`, `AppContext.skipFirstCar` | Register a new number: **Skip for now** under the button opens Home. Booking then asks for a car on Select Vehicle. |
| 12 | Notifications when the technician accepts and arrives | B | `OrderStatusWatcher`, `push.ts` | In-app: notifications for accepted, on the way and arrived on any screen. App closed: see "Push" below. |
| 13 | Car photo uploaded to Cloud Storage and shown to the technician | B | `photoUpload.ts`, `AppContext.placeOrder`, `ProviderJobView`, `firebase/storage.rules` | Development build: attach a photo, place the order; it appears in Storage under `order-photos/{uid}/` and on the job in Provider Mode. |
| 16 | Android build | B | `eas.json`, `package.json`, [android-build.md](android-build.md) | `npm run build:android`, install the APK, run the checks in the guide. |

## Provider Mode (feature 4)

Profile > **Provider Mode**. It has two sources of jobs:

| Who opens it | Jobs shown | Accepting |
|---|---|---|
| A registered technician in the development build (`providers/{uid}` exists) | Live from Firestore: every order sent to providers that no one has accepted, plus their own jobs | Writes `providerId`, the technician's details, `status: accepted`, `acceptedAt` and the status history to `orders/{id}` |
| Anyone else (Expo Go, or a number that is not a technician) | Test on one phone: this account's own orders, when **Send my new orders to Provider Mode** is on | Updates the order on the phone; Track Order follows each step |

**Demo on one phone:** Profile > Provider Mode > turn on **Send my new orders to Provider Mode** > book a jump start > Track Order says "Not accepted yet" > Profile > Provider Mode > **Accept Job** > Track Order shows "Accepted by …" > back in the job: **Start Driving to Customer**, **I've Arrived**, **Mark Job as Done**.

**Register a technician (development build):**

1. The technician signs in to SANAD once with their number.
2. `npm run add:provider -- --phone 55550123 --name "Ahmed Al-Mansouri" --business "Al Sadd Auto" --vehicle "Toyota Hilux service van" --plate 61570 --services battery,tire --key ~/sanad-key.json` (same service account key as `seed:services`; `--dry-run` prints the document, `--remove` deletes it).
3. Publish the updated `firebase/firestore.rules` and the new `firebase/storage.rules` in the Firebase console.
4. Rebuild the development build once (`npm run prebuild` then `npm run ios:device`), because Cloud Storage is a new native module.

### Rules Playground checks (orders)

Create `providers/provA` (any fields) and `orders/o1` with `customerId: "custA"`, `providerId: null`, `dispatch: "provider"`, `status: "confirmed"`, `offeredTo: "provA"` in the console first (since feature 8 an open order is only visible to the technician it is offered to).

| # | Simulation | Location | Auth UID | Body (fields changed) | Expected |
|---|---|---|---|---|---|
| 1 | get | `orders/o1` | `provA` | | Allowed (open job) |
| 2 | get | `orders/o1` | `custB` | | Denied |
| 3 | update | `orders/o1` | `provA` | `providerId: "provA"`, `status: "accepted"` | Allowed |
| 4 | update | `orders/o1` | `custB` (not a provider) | `providerId: "custB"`, `status: "accepted"` | Denied |
| 5 | update | `orders/o1` | `custA` | `providerId: "custA"` | Denied (a driver cannot assign a technician) |
| 6 | update | `orders/o1` after 3, i.e. `providerId: "provA"`, `status: "accepted"` | `provA` | `status: "arrived"` | Denied (skips On the way) |
| 7 | update | same | `provA` | `status: "on_the_way"` | Allowed |
| 8 | update | same | `provB` (another provider) | `providerId: "provB"`, `status: "accepted"` | Denied (already taken) |
| 9 | update | `providers/provA` | `provA` | `rating: 5` | Denied (only `isOnline` and location) |

## Push with the app closed (feature 12)

The driver's phone registers an Expo push token after sign-in and saves it on each order (`customerPushToken`). When the technician accepts, sets off or arrives, the technician's phone sends the message through Expo's push service (`src/services/push.ts`), so no separate server is needed. It needs:

- an EAS project id in `app.json` (`npx eas init` adds `extra.eas.projectId`), and
- **iOS:** a paid Apple Developer account, building with `SANAD_PUSH=1` so the push entitlement is kept; **Android:** FCM credentials uploaded with `npx eas credentials -p android`.

Without them `registerPushToken()` returns null, nothing is sent, and the driver still gets the in-app notifications while SANAD is open.

## Connecting to Hassan's features (5, 7, 8)

The provider side reads and writes `orders/{id}` directly, so it works as soon as orders are saved to Firestore (feature 5). For that feature:

- **Write the order with `orderToDoc(order, uid)`** from `src/models/firestore.ts`. It now also stores `dispatch`, the customer's name and phone, the push token, the photo URL, the directions (`address.landmark`) and the status history. The rules require `providerId: null` on create.
- **Send orders to technicians** by setting `dispatch: 'provider'` in `placeOrder` (today only the Provider Mode test switch does this; `'simulated'` orders are never shown to technicians).
- **Listen to the order** (`onDoc('orders/{id}')`) and replace the local order with `decodeOrder(id, data)` from `src/services/providerRepo.ts`. Track Order, the Accepted card and the notifications then follow the technician with no other change.
- **After a technician accepts, update only the fields the driver changes** (for example a cancellation) instead of `set`-ing the whole order: the rules refuse a driver write that touches `providerId`, `provider` or `acceptedAt`.
- **Upload timing:** the car photo URL is added to the order a moment after it is placed (`photoPath`, `photoUrl`); write it with an update when it arrives.

For live tracking (feature 7), set `LIVE_TRACKING_READY = true` in `src/models/tracking.ts` to remove the Demo Mode badge for real-provider orders, and replace `providerProgress` on Track Order with the position from `orders/{id}/tracking/live`. Provider matching (feature 8) can use `providers` with `isOnline` and the `services` each profile lists.

# Hassan's Features (5, 7, 8, 9, 14, 15)

| # | Feature | Level | Where | How to check |
|---|---|---|---|---|
| 9 | Prices from the Firestore catalogue | A | `catalogRepo.ts`, `scripts/seed-services.ts` | `npm run seed:services -- --dry-run`, then `npm run seed:services -- --key <path to key>`. The six documents appear under `services`. Change one price in the console, relaunch the app: the new price shows on the service screen. |
| 5 | Orders in Firestore with status history, live for the driver | A | `ordersRepo.ts`, `models/orders.ts`, `AppContext` (`placeOrder`, `setOrderStatus`, live listener) | Development build: place an order. It appears under `orders/` with `customerId`, `providerId: null` and `statusHistory`. A technician on a second phone accepts it and moves it along; the driver's Track Order follows each step with no refresh. |
| 8 | Nearest available provider matching | A | `matching.ts`, `providerRepo.listenOpenJobs`, `ProviderJobsView` (online switch), rules | Two registered technicians online. The order's `offeredTo` is the nearer one (by road), and only they see it under New requests. Turn them off with **Available for new jobs** (or wait 2 minutes): `offeredTo` changes to the other one and `offeredBefore` lists the first. |
| 7 | Live tracking from the technician's real location | A | `trackingRepo.ts`, `useShareLocation` (technician), `useLiveTracking` + `TrackOrderView` (driver), `LIVE_TRACKING_READY = true` | Technician taps **Start Driving to Customer**: the job shows "Sharing your live location" and `orders/{id}/tracking/live` updates every few seconds. The driver's van moves to that position within a few seconds and shows "Live location · x km away" with the live ETA. Writing a test `location` GeoPoint in the console moves the van too. No Demo Mode badge for real-technician orders. |
| 14 | Rate the technician | B | `models/reviews.ts`, `reviewsRepo.ts`, `useReviews.ts`, `RateTechnicianCard`, `TrackOrderView`, `OrdersView`, `ProviderJobsView`, rules | After a job sent to a technician is done, Track Order and Orders show **Rate your technician** (1 to 5 stars, optional comment up to 300 characters). Sending it writes `reviews/{orderId}` once; the card then shows the stars given. The technician's rating on Track Order and in Provider Mode is the average of their reviews, or the profile's `rating` when there are none. |
| 15 | Book again | B | `rebookDraft` in `models/orders.ts`, `OrdersView` | Orders > Completed > **Book again** opens Location with the last address selected, so the driver confirms or changes it, then the service screen with the same option and car (for now, ASAP). |

Feature 14 keeps ratings in their own collection instead of changing the technician's profile, so the rules can check each review against its order: `reviews/{orderId}` holds `orderId`, `providerId`, `customerId`, `stars` (1 to 5), `comment` (or null) and `createdAt`. Only the driver of that order can create it, only when the order is done and `providerId` matches the technician who did it, and nobody can update or delete it, so an order is rated once. Simulated orders and Provider Mode on one phone (`device:` technicians) show no rating card.

## How the parts connect

- **Placing an order (development build).** `placeOrder` keeps the order on the phone as before, then writes it to `orders/{id}` with `orderToDoc`. Order ids end with four characters of the driver's user id (`SND-1043-K7QF`) so two drivers never write the same document.
- **Who gets it.** `dispatch` is `'provider'` when at least one online technician offers the service (`providers` where `isOnline == true`), otherwise `'simulated'`, so a demo never waits forever. The **Send my new orders to Provider Mode** switch still forces `'provider'` for testing on one phone. For `'provider'` orders, the online technicians are ranked by road distance (OSRM, 4 s limit each) from their `lastLocation`, or their `base` when they have not shared a location yet, with the straight line as the fallback, and the order is written with `offeredTo`, `offeredAt` and `offeredBefore`.
- **Moving on.** Every 15 seconds the driver's phone checks its waiting orders: if the technician went offline or 2 minutes passed, it updates `offeredTo` to the next nearest technician it was not offered to yet (starting again from the nearest once everyone had it). The rules allow the driver to change these fields only while `providerId` is null.
- **Following the technician.** The driver's phone listens to `orders` where `customerId == uid` and merges them into the phone's orders (`mergeOrders`): orders sent to technicians follow Firestore; simulated orders keep the phone's copy because the phone moves them along, and their status changes are written with an update. After placing, the driver's phone only ever updates the fields it may change (`DRIVER_ORDER_FIELDS`), never `set`, so a technician's acceptance is never overwritten. The car photo URL is written with an update when the upload finishes.
- **Live location.** While a job is `on_the_way`, the technician's phone watches its location in the foreground (`expo-location`, every 4 s or 10 m) and writes `orders/{id}/tracking/live` (`location`, `heading`, `etaMin`, `updatedAt`) and `providers/{uid}.lastLocation` and `geohash` in one batch. A position older than 2 minutes is ignored and the animation is used instead. Sharing now runs app-wide: `LiveLocationProvider` (in `App.tsx`) watches the technician's own jobs and shares for the one that is on the way, so it keeps going when the technician leaves the job screen. It still stops when the phone is locked or SANAD goes to the background, because only foreground location is used (background location needs `expo-task-manager`, the background location permission and a new build).
- **Indexes.** Every query uses equality filters only, so no composite index is needed (no `firestore.indexes.json`).

## Changes to Nasser's files

| File | Change |
|---|---|
| `src/models/types.ts`, `src/models/firestore.ts` | `offeredTo`, `offeredAt`, `offeredBefore` on `Order`, `OrderDoc`, `orderToDoc` and `orderFromDoc`. |
| `src/services/providerRepo.ts` | `listenOpenJobs(uid, ...)` also filters `offeredTo == uid`; `decodeOrder` reads `offeredAt`. |
| `src/viewModels/useProviderJobs.ts`, `src/views/provider/ProviderJobsView.tsx` | Passes the technician's id to `listenOpenJobs`; adds `setOnline` and an **Available for new jobs** switch. |
| `src/views/provider/ProviderJobView.tsx` | Shows a banner while sharing, read from `useLiveLocation()` (the sharing itself moved to `LiveLocationProvider`). |
| `src/views/provider/ProviderJobsView.tsx` | Shows the technician's average rating and how many reviews it comes from. |
| `App.tsx` | Wraps the app in `LiveLocationProvider`. |
| `src/views/orders/TrackOrderView.tsx` | Uses the live position and ETA when there is one; Demo Mode stays for simulated orders and for Provider Mode on one phone. |
| `src/models/tracking.ts` | `LIVE_TRACKING_READY = true`. |
| `src/viewModels/AppContext.tsx` | Order ids, writing and listening to orders, matching, re-offering, Book again. |
| `firebase/firestore.rules` | See below. |
| `__tests__/providerJobs.test.ts`, `__tests__/version2.test.ts` | Open jobs test uses `offeredTo`; the Demo Mode badge test expects no badge for real-technician orders. |

## Rules changes (publish `firebase/firestore.rules` again)

- A provider reads and accepts an open order only when `offeredTo` is their uid.
- The driver may change `offeredTo`, `offeredAt` and `offeredBefore` only while `providerId` is null, can never change `dispatch`, and on an order sent to technicians may set the status only to `cancelled`.
- On an order sent to technicians, the driver may change `statusHistory` only when cancelling, and only by adding one `cancelled` entry at the end (the earlier entries must stay the same).
- New `reviews/{orderId}` rules for feature 14 (see above).

### Rules Playground checks (Hassan's features)

Use the console data from the table above (`orders/o1` offered to `provA`), plus `providers/provB`.

| # | Simulation | Location | Auth UID | Body (fields changed) | Expected |
|---|---|---|---|---|---|
| 10 | get | `orders/o1` | `provB` (a provider it is not offered to) | | Denied |
| 11 | update | `orders/o1` | `provB` | `providerId: "provB"`, `status: "accepted"` | Denied (offered to provA) |
| 12 | update | `orders/o1` | `custA` | `offeredTo: "provB"`, `offeredBefore: ["provA"]` | Allowed (moving the offer on) |
| 13 | update | `orders/o1` after 3 (`providerId: "provA"`) | `custA` | `offeredTo: "provB"` | Denied (already accepted) |
| 14 | update | `orders/o1` | `custA` | `status: "accepted"` | Denied (only a technician moves it) |
| 15 | update | `orders/o1` | `custA` | `status: "cancelled"` | Allowed |
| 16 | update | `orders/o1` | `custA` | `dispatch: "simulated"` | Denied |
| 17 | create | `orders/o2` | `custA` | `customerId: "custA"`, `providerId: null` | Allowed |
| 18 | create | `orders/o3` | `custA` | `customerId: "custB"`, `providerId: null` | Denied |
| 19 | create | `orders/o1/tracking/live` after 3 | `provA` | `location`, `etaMin`, `updatedAt` | Allowed |
| 20 | create | `orders/o1/tracking/live` after 3 | `provB` | same | Denied |
| 21 | get | `orders/o1/tracking/live` | `custA` | | Allowed |
| 22 | update | `providers/provA` | `provA` | `lastLocation`, `geohash` | Allowed |
| 23 | update | `orders/o1` | `custA` | `status: "cancelled"`, `statusHistory` + one `cancelled` entry | Allowed |
| 24 | update | `orders/o1` | `custA` | `statusHistory` rewritten (`confirmed`, `done`) | Denied |
| 25 | update | `orders/o1` after 3 | `custA` | `status: "cancelled"`, `statusHistory: [cancelled]` (drops entries) | Denied |

For the review checks add `orders/o4` like `o1` after 3 but with `status: "done"`.

| # | Simulation | Location | Auth UID | Body | Expected |
|---|---|---|---|---|---|
| 26 | create | `reviews/o4` | `custA` | `orderId: "o4"`, `providerId: "provA"`, `customerId: "custA"`, `stars: 5`, `comment: "Quick"`, `createdAt` (timestamp) | Allowed |
| 27 | update | `reviews/o4` (exists) | `custA` | `stars: 1` | Denied (rated once) |
| 28 | delete | `reviews/o4` (exists) | `custA` | | Denied |
| 29 | create | `reviews/o4` | `custB` | as 26 with `customerId: "custB"` | Denied (not their order) |
| 30 | create | `reviews/o4` | `custA` | as 26 with `providerId: "provB"` | Denied (wrong technician) |
| 31 | create | `reviews/o1` | `custA` | as 26 with `orderId: "o1"` | Denied (order not done) |
| 32 | create | `reviews/o4` | `custA` | as 26 with `stars: 6` | Denied |

## Results (25 and 28 Nov 2026)

**Rules.** `firebase/firestore.rules` was published in the console on 25 Nov 2026 at 10:19 (Doha). Cloud Storage was enabled (default bucket `sanad-9d5f6.firebasestorage.app`, no-cost location US-EAST1) and `firebase/storage.rules` was published the same morning.

All 32 checks above were run against `firebase/firestore.rules` in the Firestore emulator (firebase-tools, `@firebase/rules-unit-testing`), with the console data described above written before each check. Actual results: **32 of 32 match the expected result** (Allowed for 1, 3, 7, 12, 15, 17, 19, 21, 22, 23, 26; Denied for all the others). They were not clicked through the console's Rules Playground one by one.

`npm run check:rules` (`scripts/check-rules.ts`) sends the same 32 checks to the Firebase Rules API, but the service account key we use for `seed:services` gets `403 PERMISSION_DENIED` (it lacks `firebaserules.rulesets.test`). It works with a key or account that has the Firebase Rules Admin role.

| # | Feature | Status | Evidence |
|---|---|---|---|
| 9 | Prices from Firestore | Partly verified | `npm run seed:services -- --dry-run`, then with `--key`: six documents under `services` (battery, carwash, emergency, fuel, oil, tire), seen in the console. Not verified yet: a console price change showing in the app after relaunch. |
| 5 | Orders in Firestore | Verified on phones (28 Nov) | Orders SND-1043-VQHV to SND-1046-VQHV: each has `customerId`, `dispatch: "provider"`, `providerId`, the technician's details after accepting, and a `statusHistory` from confirmed to done. The driver's Track Order followed each step without a refresh. |
| 8 | Nearest provider matching | Verified on phones (28 Nov) | Technician 2's `base` was moved to Al Wakrah so the two were at different distances. SND-1043 and SND-1044 were offered to Technician 1 (the nearer). SND-1045 went straight to Technician 2 while Technician 1 was offline. SND-1046 was offered to Technician 1, who then went offline: `offeredTo` moved to Technician 2 and `offeredBefore` lists Technician 1. |
| 7 | Live tracking | Verified on phones (28 Nov) | First run (SND-1043 to SND-1045): nothing was written because the technicians' phones did not allow location. After allowing location (While Using, Precise), SND-1046 wrote `orders/SND-1046-VQHV/tracking/live` (`location`, `etaMin`, `updatedAt`) and Technician 2's `lastLocation` and `geohash`. Still foreground only. |
| 14 | Rate the technician | Verified on phones (28 Nov) | `reviews/SND-1043-VQHV`, `SND-1044-VQHV` and `SND-1045-VQHV` were created by the driver (5 stars each), one per order. |
| 13 | Car photo upload | Verified on phones (28 Nov) | Each of SND-1043 to SND-1046 has `photoPath` under `order-photos/{uid}/` and a `photoUrl`, and the photo showed on the technician's job. |
| 15 | Book again | Verified on a phone (28 Nov) | After the final review fix, Book again opens Location with the last address, then books the same service. Also tested end to end in `__tests__/appFlows.test.tsx`. |
| 16 | Android build | Built and tested on an emulator with Firebase (28 Nov) | Release APK 0.5.0 on an Android 16 emulator: Firebase sign-in with the test number, normal booking, GPS off with Find on Map, Book again and Track Order with the Leaflet map, orders saved to Firestore (SND-1043-JINW to SND-1045-JINW), no crashes. Not tried on a physical Android phone yet. See [android-build.md](android-build.md). |
| 2 | Find on Map (typed location) | Verified on a phone (28 Nov) | With GPS off, the typed place was found on the map, the pin checked and the order placed there. Also tested end to end, including a place that is not found (the driver taps the map). |

**Three-phone test (28 Nov 2026):** Hassan was the driver, Nasser was Test Technician 1 (plate 1111) and Mohammed was Test Technician 2 (plate 2222), all on the iOS Release build installed from Xcode. Order ids: SND-1043-VQHV, SND-1044-VQHV, SND-1045-VQHV, SND-1046-VQHV.

**Phone check of the final fixes (28 Nov 2026):** after PR #5's last fixes, Nasser tapped through normal booking with GPS, GPS off with Find on Map, and Book again on a phone. All three worked.

## Known limits from the final code review (28 Nov 2026)

Fixed before merging: saved addresses typed before the map lookup no longer count as a real position, **Book again** opens Location first, and a refused re-offer (the technician accepted at the same moment) no longer shows an error. These are not fixed yet:

| Area | Limit | Way forward |
|---|---|---|
| Privacy | A technician an order is offered to can read the driver's name, phone and push token in Firestore before accepting. The app only hides them on screen. | Move these fields to `orders/{id}/private/contact`, readable by the driver and the assigned technician only. |
| Orders | The order number comes from the orders on the phone. Right after a fresh install, before the phone has received the driver's orders, a new order could reuse an existing number and replace that order. | Make `createdAt` unchangeable in the rules, or check the id before creating. |
| Orders | For orders sent to technicians, the order is written to Firestore only after the road ranking (up to 4 seconds). If SANAD is closed in that time, no technician sees it. | Create the order first, then add `offeredTo`. |
| Push | The push token is saved on orders placed after it arrives. An order placed in the first seconds after sign-in, or before notifications are allowed, gets no closed-app push. | Add the token to open orders when it arrives. |
| Matching | Moving an offer on runs on the driver's phone every 15 seconds, only while SANAD is open there, and a technician who closes the app stays online. | A Cloud Function or scheduled job on `orders`, and clearing `isOnline` on disconnect. |
| Performance | Every driver's phone listens to all online technicians, whose location changes every 4 seconds during a job, so the app redraws that often. | Keep only the technician ids in the app state. |
| Rules script | `npm run check:rules` sends dates as text, so check 26 (`createdAt is timestamp`) would fail on the Rules API. The 32 checks were run in the emulator instead. | Send a timestamp for `createdAt`, or keep using the emulator. |
