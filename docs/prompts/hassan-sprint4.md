# Sprint 4 prompt for Hassan (Firestore data)

Copy everything below the line into Claude (Claude Code or Cowork with the repo folder connected).

---

You are helping me (Hassan Al-Qassabi, Andrew ID haq) deliver my Sprint 4 features for **SANAD**, our team's React Native app for 67-443 Mobile Applications at CMU-Qatar. SANAD lets drivers in Qatar book car services (battery, fuel delivery, car wash, tires, oil change, emergency towing) and track the technician.

## Repo and branch

- Repo: https://github.com/nejail/sanad-project (clone it, or use my local copy).
- Start from the `sprint-4` branch: `git fetch && git checkout sprint-4 && git checkout -b sprint-4-firestore`.
- When done, push `sprint-4-firestore` and open a pull request into `sprint-4`.
- Commit messages must not mention Claude or AI, and must not add a Co-Authored-By line. Make several small commits with clear messages.

## Project facts (do not change these)

- Expo **SDK 57** (our phones' Expo Go only supports 57). Use `npx expo install` for any Expo package.
- TypeScript strict, MVVM like the course labs: `src/models`, `src/services`, `src/viewModels`, `src/views`. Comment every function.
- React Native Firebase **27.1.0** is already installed: `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/firestore`. Use the **modular API** (`getFirestore`, `doc`, `getDoc`, `setDoc`, `collection`, `onSnapshot`, ...) from `@react-native-firebase/firestore`. Do **not** add the `firebase` web SDK: auth state must come from React Native Firebase so security rules see `request.auth`.
- Nasser already built phone sign-in (`src/services/auth.ts`). After sign-in, `useApp().uid` is the Firebase user id and `useApp().authMode` is `'firebase'` in the development build or `'local'` in Expo Go.
- Firebase setup and how to run the development build: `docs/firebase-setup.md`. Ask Nasser for `GoogleService-Info.plist` (it is not in the repo).
- The Firestore structure was agreed in Sprint 3 and is already typed in `src/models/firestore.ts` (`UserDoc`, `CarDoc`, `AddressDoc`, `ServiceDoc`, converters `userToDoc`, `carToDoc`, `carFromDoc`, `addressToDoc`, `addressFromDoc`, paths in `COLLECTIONS`). Draft rules are in `firebase/firestore.rules`. Keep using these.
- Today, account data (user, cars, addresses, orders) is saved on the phone with AsyncStorage in `src/services/storage.ts`, and `src/viewModels/AppContext.tsx` loads it in `findAccount(phone)` and saves it in a `useEffect` that calls `saveAccount`.

## My Sprint 4 deliverables (promised in the Sprint 3 report)

1. **Users, cars and addresses in Firestore with security rules**
2. **Service catalogue read from Firestore**

## What to build

### A. Firestore repository (`src/services/firestoreRepo.ts`)

- Functions: `loadAccount(uid)`, `createUser(uid, user)`, `saveCar(uid, car)`, `deleteCar(uid, carId)`, `saveAddress(uid, address)`, and a `listenAccount(uid, onChange)` that uses `onSnapshot` so changes made on another device appear live.
- Paths: `users/{uid}`, `users/{uid}/cars/{carId}`, `users/{uid}/addresses/{addressId}` using `COLLECTIONS` and the converters in `src/models/firestore.ts`. Store coordinates as Firestore `GeoPoint` and dates as `Timestamp` (adapt the converters if needed).
- Orders stay in AsyncStorage this sprint (orders move to Firestore in Sprint 5), but keep the account shape the same so screens do not change.

### B. Use it in the app (`src/viewModels/AppContext.tsx`)

- When `authMode === 'firebase'`: after sign-in or registration, read and write the account through the repository keyed by `uid` instead of AsyncStorage. `accountExists(phone)` becomes "does `users/{uid}` exist" for the signed-in user.
- When `authMode === 'local'` (Expo Go, web, tests): keep the current AsyncStorage behaviour unchanged.
- Keep the agreed entry flow: returning user lands on Home with their cars loaded; new user goes to Add Your First Car.
- Handle offline and errors: Firestore caches offline by default; show a short message if a write fails.

### C. Security rules

- Update `firebase/firestore.rules` if needed so each user can only read and write their own `users/{uid}` tree, and signed-in users can read `services`.
- Publish them in the Firebase console (Firestore > Rules), and test in the Rules Playground: own document allowed, someone else's denied, signed-out denied. Save screenshots.

### D. Service catalogue from Firestore

- Seed the `services` collection from `src/models/catalog.ts` (six documents: `fuel`, `carwash`, `battery`, `tire`, `oil`, `emergency`, shape `ServiceDoc`). A small script or the console is fine; document how in `docs/firestore-data.md`.
- Add `src/services/catalogRepo.ts` that loads the catalogue from Firestore once per launch and falls back to the built-in `catalog.ts` if offline or in Expo Go. Home and the service screens must keep working either way.
- Show that changing a price in the console updates the app after relaunch.

### E. Tests and checks

- Unit tests in `__tests__/` for the converters and the repository logic (mock the Firestore functions; no network in tests).
- Run `npx tsc --noEmit` and `npm test`; everything must pass (there are 68 tests now).
- Run the development build on a phone and verify: register a new number, add a car, close and reopen the app, and see the car come back from Firestore; see the documents in the Firebase console.

## What to give back to me at the end

1. The branch name and a short list of commits.
2. A short summary for the Sprint 4 report: what works, how it was verified (device, console), and anything not finished with the reason.
3. Screenshots: Firestore console showing `users/{uid}` with `cars` and `addresses`, the `services` collection, and the Rules Playground results.
