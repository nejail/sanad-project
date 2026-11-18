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

Create `providers/provA` (any fields) and `orders/o1` with `customerId: "custA"`, `providerId: null`, `dispatch: "provider"`, `status: "confirmed"` in the console first.

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
