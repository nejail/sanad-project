# SANAD Feature Delivery Schedule

Assumes two-week sprints after Sprint 3 and a final demo in the first week of December 2026. Adjust the dates to the course calendar.

| Sprint | Dates | Feature | Owner | Done when |
|---|---|---|---|---|
| 4 | Oct 20 - Nov 2 | Firebase project, EAS development build (needed for native Firebase and push) | Nasser | App runs from a dev build on iOS and Android |
| 4 | Oct 20 - Nov 2 | Real phone OTP with Firebase Authentication (replaces the local OTP) | Nasser | Real SMS code signs a user in; session survives restart |
| 4 | Oct 20 - Nov 2 | Users, cars and addresses in Firestore using the defined structure and rules | Hassan | Data syncs across two devices for the same account |
| 4 | Oct 20 - Nov 2 | Service catalogue read from `services` collection | Hassan | Price change in console shows in app without an update |
| 5 | Nov 3 - Nov 16 | Orders written to Firestore with status history | Hassan | Order created on phone appears in console |
| 5 | Nov 3 - Nov 16 | Provider side (simple provider screen or web console) to accept orders and update status | Mohammed | Provider accepts; customer sees status change |
| 5 | Nov 3 - Nov 16 | Provider matching: nearest online provider using `providers` + Overpass data | Mohammed | Order is assigned to the closest available provider |
| 5 | Nov 3 - Nov 16 | Car photo upload to Cloud Storage | Nasser | Provider can open the photo attached to an order |
| 5 | Nov 3 - Nov 16 | Rate Provider screen (from the low-fidelity wireframes) | Hassan | Rating saved to `reviews` and shown on provider |
| 6 | Nov 17 - Nov 30 | Live tracking from `orders/{id}/tracking/live` with OSRM route and ETA | Mohammed | Customer sees the provider move in real time |
| 6 | Nov 17 - Nov 30 | Remote push notifications for accepted, on the way, arrived, done | Nasser | Notifications arrive with the app closed |
| 6 | Nov 17 - Nov 30 | Second user test round on the connected app and fixes | All | 4+ users complete tasks; lessons documented |
| Final | Dec 1 - Dec 7 | Polish, error states, accessibility and Arabic text checks; final demo and report | All | Demo runs end to end on a real phone |

## Dependencies and risks

- Firebase phone sign-in and remote push both need a development build, so the build comes first in Sprint 4.
- Live tracking depends on the provider side (Sprint 5) writing locations.
- The public OSRM and Overpass servers are for light use; if they rate-limit during testing, cache results or switch to a self-hosted or paid service.
- Card payment stays "Coming soon" for the course; cash on service is enough for the demo.
