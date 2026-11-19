# Version 2: Nasser's Features (after Sprint 5 user testing)

These are the Version 2 features owned by Nasser in the Sprint 5 report (section 6), in priority order. Each one names the screen it changes and how to check it. Unit tests for all of them are in `__tests__/version2.test.ts` and `__tests__/providerJobs.test.ts`.

| # | Feature | Level | Where | How to check |
|---|---|---|---|---|
| 1 | Tow price as base fee plus estimated distance from the first price screen | A | `ServiceView`, `useNearestGarage`, `towPriceExplanation` in `pricing.ts` | Emergency 24/7 > Towing: "How the tow price works" shows 200 QAR + the distance to the nearest garage, and the price card says **Estimated total** with the distance line. Review Order shows the same price. |
| 2 | Prominent "Enter Location Manually" button when GPS fails | A | `LocationView` | Turn Location Services off, start any service: a red message and a large **Enter Location Manually** button appear at the top; it opens the "Where is your car?" field. |
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

# Hassan's Features (5, 7, 8, 9, 15)

| # | Feature | Level | Where | How to check |
|---|---|---|---|---|
| 9 | Prices from the Firestore catalogue | A | `catalogRepo.ts`, `scripts/seed-services.ts` | `npm run seed:services -- --dry-run`, then `npm run seed:services -- --key <path to key>`. The six documents appear under `services`. Change one price in the console, relaunch the app: the new price shows on the service screen. |
| 5 | Orders in Firestore with status history, live for the driver | A | `ordersRepo.ts`, `models/orders.ts`, `AppContext` (`placeOrder`, `setOrderStatus`, live listener) | Development build: place an order. It appears under `orders/` with `customerId`, `providerId: null` and `statusHistory`. A technician on a second phone accepts it and moves it along; the driver's Track Order follows each step with no refresh. |
| 8 | Nearest available provider matching | A | `matching.ts`, `providerRepo.listenOpenJobs`, `ProviderJobsView` (online switch), rules | Two registered technicians online. The order's `offeredTo` is the nearer one (by road), and only they see it under New requests. Turn them off with **Available for new jobs** (or wait 2 minutes): `offeredTo` changes to the other one and `offeredBefore` lists the first. |
| 7 | Live tracking from the technician's real location | A | `trackingRepo.ts`, `useShareLocation` (technician), `useLiveTracking` + `TrackOrderView` (driver), `LIVE_TRACKING_READY = true` | Technician taps **Start Driving to Customer**: the job shows "Sharing your live location" and `orders/{id}/tracking/live` updates every few seconds. The driver's van moves to that position within a few seconds and shows "Live location · x km away" with the live ETA. Writing a test `location` GeoPoint in the console moves the van too. No Demo Mode badge for real-technician orders. |
| 15 | Book again | B | `rebookDraft` in `models/orders.ts`, `OrdersView` | Orders > Completed > **Book again** opens the service screen with the same option, car and address (for now, ASAP). |

Feature 14 (rate the provider) is not done: updating the technician's rating from the driver's phone needs a rule (or a server function) that checks the order is done and is the driver's, which is not in place yet.

## How the parts connect

- **Placing an order (development build).** `placeOrder` keeps the order on the phone as before, then writes it to `orders/{id}` with `orderToDoc`. Order ids end with four characters of the driver's user id (`SND-1043-K7QF`) so two drivers never write the same document.
- **Who gets it.** `dispatch` is `'provider'` when at least one online technician offers the service (`providers` where `isOnline == true`), otherwise `'simulated'`, so a demo never waits forever. The **Send my new orders to Provider Mode** switch still forces `'provider'` for testing on one phone. For `'provider'` orders, the online technicians are ranked by road distance (OSRM, 4 s limit each) from their `lastLocation`, or their `base` when they have not shared a location yet, with the straight line as the fallback, and the order is written with `offeredTo`, `offeredAt` and `offeredBefore`.
- **Moving on.** Every 15 seconds the driver's phone checks its waiting orders: if the technician went offline or 2 minutes passed, it updates `offeredTo` to the next nearest technician it was not offered to yet (starting again from the nearest once everyone had it). The rules allow the driver to change these fields only while `providerId` is null.
- **Following the technician.** The driver's phone listens to `orders` where `customerId == uid` and merges them into the phone's orders (`mergeOrders`): orders sent to technicians follow Firestore; simulated orders keep the phone's copy because the phone moves them along, and their status changes are written with an update. After placing, the driver's phone only ever updates the fields it may change (`DRIVER_ORDER_FIELDS`), never `set`, so a technician's acceptance is never overwritten. The car photo URL is written with an update when the upload finishes.
- **Live location.** While a job is `on_the_way`, the technician's phone watches its location in the foreground (`expo-location`, every 4 s or 10 m) and writes `orders/{id}/tracking/live` (`location`, `heading`, `etaMin`, `updatedAt`) and `providers/{uid}.lastLocation` and `geohash` in one batch. A position older than 2 minutes is ignored and the animation is used instead.
- **Indexes.** Every query uses equality filters only, so no composite index is needed (no `firestore.indexes.json`).

## Changes to Nasser's files

| File | Change |
|---|---|
| `src/models/types.ts`, `src/models/firestore.ts` | `offeredTo`, `offeredAt`, `offeredBefore` on `Order`, `OrderDoc`, `orderToDoc` and `orderFromDoc`. |
| `src/services/providerRepo.ts` | `listenOpenJobs(uid, ...)` also filters `offeredTo == uid`; `decodeOrder` reads `offeredAt`. |
| `src/viewModels/useProviderJobs.ts`, `src/views/provider/ProviderJobsView.tsx` | Passes the technician's id to `listenOpenJobs`; adds `setOnline` and an **Available for new jobs** switch. |
| `src/views/provider/ProviderJobView.tsx` | One line: `useShareLocation(order)`, plus a banner while sharing. |
| `src/views/orders/TrackOrderView.tsx` | Uses the live position and ETA when there is one; Demo Mode stays for simulated orders and for Provider Mode on one phone. |
| `src/models/tracking.ts` | `LIVE_TRACKING_READY = true`. |
| `src/viewModels/AppContext.tsx` | Order ids, writing and listening to orders, matching, re-offering, Book again. |
| `firebase/firestore.rules` | See below. |
| `__tests__/providerJobs.test.ts`, `__tests__/version2.test.ts` | Open jobs test uses `offeredTo`; the Demo Mode badge test expects no badge for real-technician orders. |

## Rules changes (publish `firebase/firestore.rules` again)

- A provider reads and accepts an open order only when `offeredTo` is their uid.
- The driver may change `offeredTo`, `offeredAt` and `offeredBefore` only while `providerId` is null, can never change `dispatch`, and on an order sent to technicians may set the status only to `cancelled`.

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
