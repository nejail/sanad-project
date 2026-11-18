# Firestore Data (Sprint 4)

In the development build, a customer's profile, cars and addresses are saved in **Cloud Firestore** under their Firebase user id, and the service catalogue (prices and options) is read from Firestore. In Expo Go and on web the app keeps working exactly as in Sprint 3, with everything on the phone.

| | Development build | Expo Go / web / tests |
|---|---|---|
| Profile, cars, addresses | Firestore `users/{uid}` (plus a copy on the phone for offline start) | AsyncStorage |
| Orders | AsyncStorage (Firestore in Sprint 5) | AsyncStorage |
| Service catalogue | Firestore `services`, built-in fallback | Built-in `src/models/catalog.ts` |

## Structure

```
users/{uid}                          name, phone (+974...), createdAt (Timestamp), defaultCarId, defaultAddressId, firstWashUsed
users/{uid}/cars/{carId}             make, model, year (number), plate, color, fuel, isDefault, lastServiceAt (Timestamp or null)
users/{uid}/addresses/{addressId}    label, line, landmark, location (GeoPoint), isDefault
services/{serviceId}                 fuel, carwash, battery, tire, oil, emergency (ServiceDoc)
```

`{uid}` is the Firebase Authentication user id, not the phone number. Types and converters: `src/models/firestore.ts`. Reading and writing: `src/services/firestoreRepo.ts`. Catalogue: `src/services/catalogRepo.ts`.

## How the app uses it

- **Sign in, returning user:** reads `users/{uid}` with its cars and addresses, then lands on Home with the cars loaded.
- **Sign in, new number:** no document, so the app goes to Register, creates `users/{uid}`, then Add Your First Car.
- **Number used before Firestore:** if the phone already has data for that number (an earlier build, or the demo account 5012 3456), it is uploaded once on first sign-in so nothing is lost.
- **Changes:** adding or removing a car or address writes only the documents that changed, in one batch (a new default car also updates the old default and `defaultCarId`).
- **Live updates:** the app listens to `users/{uid}`, its cars and its addresses, so a car added on another phone appears without restarting.
- **Offline:** Firestore caches data and queues writes until the phone is back online. A copy of the account is also kept on the phone so the app opens offline. If a write is refused (for example by the security rules), a short message appears at the bottom of the screen.
- **Catalogue:** after sign-in the app reads `services` once per launch (4 second limit). Each usable document replaces the built-in service with the same id; a missing or broken document keeps the built-in one. `active: false` hides a service from Home.

## Seeding the `services` collection

The security rules do not let the app write to `services`, so it is seeded as an admin:

1. Firebase console > Project settings > **Service accounts** > **Generate new private key**. Save the JSON somewhere outside the repo (it is a secret).
2. Preview what will be written (writes nothing):
   ```bash
   npm run seed:services -- --dry-run
   ```
3. Write the six documents:
   ```bash
   npm run seed:services -- --key ~/Downloads/sanad-firebase-key.json
   ```
4. Firestore Database > Data now shows `services` with `battery`, `carwash`, `emergency`, `fuel`, `oil`, `tire`.

Running it again resets every price to the values in `src/models/catalog.ts`.

**Changing a price:** Firestore Database > Data > `services` > `battery` > `options` > `0` (Jump Start) > change `price` to `60` and `priceLabel` to `60 QAR`. Close and reopen the app: the Battery screen shows 60 QAR and the total is 63.00 QAR with VAT. Run the seed script to put it back.

## Security rules

Rules: `firebase/firestore.rules`. Publish: Firestore Database > **Rules** > paste the file > **Publish**.

What they enforce for this sprint:

- Each user can read and write only their own `users/{uid}` tree. Other users and signed-out requests are denied.
- The profile's `phone` must be the number Firebase Authentication verified, and cannot be changed later.
- Profile, car and address documents may only contain the fields the app writes.
- Signed-in users can read `services`; nobody can write it from the app.

### Rules Playground checks

Firestore Database > Rules > **Rules Playground**. Use any id for `uidA` (for example `testUserA`). Take a screenshot of each result.

| # | Simulation type | Location | Authenticated | Expected |
|---|---|---|---|---|
| 1 | get | `users/testUserA` | Yes, UID `testUserA` | Allowed |
| 2 | get | `users/testUserA/cars/car-1` | Yes, UID `testUserA` | Allowed |
| 3 | get | `users/testUserA` | Yes, UID `testUserB` | Denied |
| 4 | get | `users/testUserA/addresses/addr-1` | Yes, UID `testUserB` | Denied |
| 5 | get | `users/testUserA` | No | Denied |
| 6 | get | `services/battery` | Yes, any UID | Allowed |
| 7 | get | `services/battery` | No | Denied |
| 8 | create | `services/battery` | Yes, any UID | Denied |
| 9 | create | `users/testUserA/cars/car-1`, body `{"make":"Kia","plate":"QA-1","isDefault":true}` | Yes, UID `testUserA` | Allowed |
| 10 | create | same as 9, UID `testUserB` | Yes, UID `testUserB` | Denied |

## Checking it on a phone

1. `npm run ios:device` (development build, see `docs/firebase-setup.md`).
2. Register a new number (or use a test number from Authentication > Sign-in method), add a car and an address.
3. Firebase console > Firestore Database > Data: `users/{uid}` with `cars` and `addresses` subcollections. Screenshot.
4. Close the app completely and reopen it: Home shows the car, now loaded from Firestore.
5. Delete the car in the console: it disappears from My Cars while the app is open.
6. Profile > Technology Feasibility Tests: **Account data in Firestore** and **Service catalogue** pass.
