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
