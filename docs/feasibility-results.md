# Technology Feasibility Results

Run with the in-app Feasibility Tests screen (Profile > Technology Feasibility Tests).

- **Device:** Apple iPhone 17 Pro, iOS 26.7.1, physical device
- **Runtime:** Expo Go (SDK 57)
- **Date:** 2026-10-19
- **Result:** 12 of 12 passed

| Technology | Test | Result | Time | Detail |
|---|---|---|---|---|
| react-native-maps | Map rendering | Pass | n/a | Map tiles loaded (onMapReady fired) |
| expo-location | GPS position | Pass | 541 ms | 25.31682, 51.43846, accurate to ±8 m |
| expo-location (reverse geocoding) | Address lookup | Pass | 534 ms | Doha centre resolved to "Wadi Mushaireb Street, Doha" |
| expo-notifications (local) | Notifications | Pass | 32 ms | Notification scheduled for 3 seconds later |
| expo-secure-store | Secure session storage | Pass | 19 ms | Token stored, read back and deleted in the iOS Keychain |
| AsyncStorage | Offline data storage | Pass | 14 ms | JSON record written, read back and deleted |
| App logic | OTP verification rules | Pass | 0 ms | Wrong code rejected, right code accepted, expired code rejected |
| Linking (tel:) | Phone dialer | Pass | 8 ms | tel: links can be opened |
| fetch (HTTPS) | Network round trip | Pass | 206 ms | HTTP 204 |
| expo-haptics | Haptic feedback | Pass | 28 ms | Success vibration triggered |
| expo-image-picker | Camera | Pass | 5997 ms* | Photo captured |
| expo-image-picker | Photo library | Pass | 2826 ms* | Photo selected |

\* Camera and photo library times include the time the tester spent taking or choosing the photo, so they measure the user, not the technology.

## Notes

- The notification test confirms the notification was scheduled; whether it appeared on screen is checked by eye.
- GPS returned a fix accurate to 8 m in about half a second, which is enough to place a driver at the right exit or parking area.
- Not covered by these tests: real SMS OTP, remote push notifications, payments, and live provider tracking. These need a backend and are listed under Known limitations in the README.

## Run 2: external APIs (2026-10-20)

Same iPhone 17 Pro, after the external APIs were added. All 12 device tests passed again (GPS ±12 m in 238 ms, network 173 ms).

| Technology | Test | Result | Time | Detail |
|---|---|---|---|---|
| Overpass API | Nearby garages | Fail | 20013 ms | All 4 public servers timed out (first attempt with one server timed out after 12 s) |
| Nominatim search API | Nearby garages | Pass | 585 ms | 5 garages parsed; nearest "International Auto Electricals", 1.93 km |
| OSRM route API | Road distance and ETA | Pass | 402 ms | Al Sadd to Education City: 8.96 km, 13 min, 302 route points (152 to 452 ms across runs) |

Result: the app asks Nominatim and Overpass at the same time and uses the first that answers, so on the phone nearby garages come from Nominatim in under a second.
