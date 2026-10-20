# SANAD Data Needs and Mapping

Every screen from the high-fidelity wireframes, the data it reads or writes, the app-side struct that holds it, and where that data comes from now (prototype) and after the backend is added.

Structs live in `src/models/types.ts` (app) and `src/models/firestore.ts` (Firebase documents). External API parsing lives in `src/api/osm.ts`.

## Data sources

| Source | Type | What it provides | Status |
|---|---|---|---|
| Overpass API (`POST https://overpass-api.de/api/interpreter`) | External, JSON | Real garages, tyre shops, fuel stations and car washes near a point | Integrated and parsed |
| OSRM route API (`GET https://router.project-osrm.org/route/v1/driving/{lon,lat};{lon,lat}?overview=full&geometries=geojson`) | External, JSON | Road distance, driving time and route geometry | Integrated and parsed |
| Device location (`expo-location`) | Device API | GPS position, reverse geocoded address | Integrated |
| AsyncStorage (`sanad:account:{phone}`) | Internal data store | User, cars, addresses, orders as JSON | Integrated |
| Secure Store (`sanad_session`) | Internal data store | Session token in Keychain/Keystore | Integrated |
| Service catalogue (`src/models/catalog.ts`) | Internal, static | Services, options, prices | Integrated; moves to `services/{id}` |
| Firebase Authentication (phone) | Backend | Real SMS OTP and user ID | Next sprint (OTP simulated now) |
| Cloud Firestore | Backend | Users, cars, addresses, orders, providers, tracking, reviews | Structure defined; next sprint |
| Cloud Storage | Backend | Car photos for orders | Next sprint |

## App structs

| Struct | Fields | Firestore location |
|---|---|---|
| `User` | phone, name, createdAt | `users/{uid}` (`UserDoc`) |
| `Car` | id, make, model, year, plate, color, fuel, isDefault, lastService | `users/{uid}/cars/{carId}` (`CarDoc`) |
| `Address` | id, label, line, landmark, coords, isDefault | `users/{uid}/addresses/{id}` (`AddressDoc`) |
| `ServiceDefinition` / `ServiceOption` / `ServiceAddOn` | id, title, prompt, options (title, subtitle, price), addOns, pricing type | `services/{serviceId}` (`ServiceDoc`) |
| `BookingDraft` | service, option, add-ons, litres, distance, notes, photo, car, address, schedule, payment, providerBase, towTo | In memory until the order is placed |
| `Quote` / `QuoteLine` | lines, subtotal, VAT 5%, total, isEstimate | Embedded in `orders/{id}.quote` |
| `Order` | id, service, option, title, car, address, schedule, quote, payment, notes, photo, promoApplied, towTo, status, provider | `orders/{orderId}` (`OrderDoc`) |
| `Provider` | name, rating, vehicle, phone, base (place), etaMin | `providers/{id}` (`ProviderDoc`) |
| `Place` (API) | id, name, kind, coords, distanceKm, phone, openingHours | Parsed from Overpass JSON; stored as `PlaceRef` on orders |
| `Route` (API) | distanceKm, durationMin, path | Parsed from OSRM JSON |
| Tracking | location, heading, etaMin, updatedAt | `orders/{id}/tracking/live` (`TrackingDoc`) |
| Review | orderId, providerId, stars, comment | `reviews/{id}` (`ReviewDoc`) |

## Screen to data mapping

| # | Screen | Data read | Data written | Struct | Prototype source | Production source |
|---|---|---|---|---|---|---|
| 01 | Splash | Saved session; user account | none | Session, AccountData | Secure Store + AsyncStorage | Firebase Auth state + `users/{uid}` |
| 02 | Sign In | none | Phone number | User.phone | Local OTP service | Firebase Auth `signInWithPhoneNumber` |
| 02a | Register | none | Phone, name | User | Local OTP service, AsyncStorage | Firebase Auth + create `users/{uid}` |
| 02b/02c | Verify OTP | Code status (expiry, attempts, resend) | Session | Session | Local OTP rules, Secure Store | Firebase Auth `confirm(code)` |
| 02d | Add First Car | none | New car | Car | AsyncStorage | `users/{uid}/cars` |
| 03 | Home | Name, cars, active order, promo eligibility, catalogue "from" prices | none | User, Car[], Order[], ServiceDefinition[] | AsyncStorage + catalogue | `users/{uid}`, `cars`, `orders where customerId`, `services` |
| 04 | Service (x6) | Options, prices, add-ons, promo eligibility | Option, add-ons, litres, notes, photo | ServiceDefinition, BookingDraft, Quote | Catalogue + image picker | `services/{id}`; photo to Cloud Storage |
| 05 | Select Vehicle | Cars | Selected car | Car[], BookingDraft.carId | AsyncStorage | `users/{uid}/cars` |
| 06 | Add Car | none | New car | Car | AsyncStorage | `users/{uid}/cars` |
| 07 | Location | Saved addresses, GPS, reverse geocoded address, map | Selected address / pin | Address, Coordinates | AsyncStorage + expo-location + map | `users/{uid}/addresses` + device GPS |
| 08 | Schedule | Next 4 days, time slots | Schedule | Schedule | Generated in app | Provider availability from `providers` |
| 09 | Review Order | Draft, quote, **nearest real provider and road ETA**, **garages to tow to with road distance** | Payment, promo, provider base, tow destination | BookingDraft, Quote, Place, Route | **Overpass + OSRM** | Overpass/OSRM (or self-hosted) + `providers` near geohash |
| 10 | Order Placed | New order | Order | Order | AsyncStorage | `orders/{orderId}` |
| 11 | Track Order | Order, provider base, **road route**, status, ETA | Status updates | Order, Route | OSRM + simulated movement | `orders/{id}/tracking/live` written by the provider app |
| 12 | My Cars | Cars | Remove car | Car[] | AsyncStorage | `users/{uid}/cars` |
| 13 | My Orders | Orders split into active and completed | none | Order[] | AsyncStorage | `orders where customerId == uid` |
| 14 | Profile | Name, phone, order count, amount spent | Logout | User, Order[] | AsyncStorage, Secure Store | `users/{uid}`, `orders`; Firebase Auth sign out |
| 15 | My Addresses | Addresses | none | Address[] | AsyncStorage | `users/{uid}/addresses` |
| 16 | Add Address | GPS + reverse geocoded address | New address | Address | expo-location, AsyncStorage | `users/{uid}/addresses` |
| low-fi | Rate Provider | Order, provider | Stars, comment | ReviewDoc | Not built yet | `reviews/{id}` |

## External API details

### Overpass API (nearby providers)

Request (form-encoded POST body `data=`):

```
[out:json][timeout:20];
(node["shop"="car_repair"](around:5000,25.3155,51.439);
 way["shop"="car_repair"](around:5000,25.3155,51.439););
out center;
```

Service to OpenStreetMap tag: battery, oil change, emergency = `shop=car_repair`; tire = `shop=tyres` or `shop=car_repair`; fuel = `amenity=fuel`; car wash = `amenity=car_wash`.

JSON fields used: `elements[].type`, `id`, `lat`/`lon` (nodes) or `center.lat`/`center.lon` (ways), `tags.name:en`, `tags.name`, `tags.brand`, `tags.phone`, `tags.opening_hours`. Parsed into `Place`, de-duplicated and sorted by distance (`parseOverpass`).

### OSRM route API (distance, ETA, route)

`GET https://router.project-osrm.org/route/v1/driving/51.4973,25.2847;51.439,25.3155?overview=full&geometries=geojson`

JSON fields used: `code` (must be `Ok`), `routes[0].distance` (metres), `routes[0].duration` (seconds), `routes[0].geometry.coordinates` (`[lon, lat]` pairs). Parsed into `Route` (`parseOsrmRoute`).

Both public servers are free, keyless and for light use only. For launch SANAD would self-host OSRM and Overpass with Qatar data, or move to a paid provider (Google Places and Routes).
