# SANAD Sprint 4 user testing

Owner: Mohammed Al-Marri (mrmarri). Target: `sprint-4`. Work branch: `sprint-4-user-testing`.

**Status: preparation complete; sessions and results pending.** This document contains the study protocol and report structure, not observed results. No Sprint 4 participants, measurements, or quotes have been supplied.

## Goal and previous round

Test the first app version, including Firebase SMS sign-in, and revisit technician contact, towing price interpretation, and technician acceptance confirmation.

The Sprint 4 brief reports a Sprint 3 baseline of 5 drivers, 28/30 completed tasks (93.3%), and mean ease 4.4/5. Reported concerns: Call/WhatsApp were easy to miss; the towing estimate looked final; acceptance needed clearer confirmation. These are prior-round findings, not Sprint 4 observations. The baseline does not specify whether assisted completions count.

Source plan: [Sprint 3 protocol](user-test-plan.md). Assignment: [Mohammed's Sprint 4 brief](prompts/mohammed-sprint4.md).

## Participants and session setup

- Recruit at least 5 people who drive in Qatar, including at least 2 who did not participate in Sprint 3. Assign anonymous IDs P1, P2, and so on. Recruitment targets are not actual participant counts.
- Use Nasser's development build on a phone with real Firebase SMS. If unavailable, use Expo Go and label the session **prototype code; real SMS not tested**. Record build identifier/commit, phone/OS, date, language, network, and sign-in mode for every session.
- Use one facilitator and, if possible, one note taker. Print one [participant note sheet](user-testing-sprint4-note-sheet.pdf) per person. Allow about 20-30 minutes, including questions.
- Obtain agreement before starting: **"Notes are anonymous and used only for a course project"**. Participation is voluntary; the participant may stop at any time. Record agreement without a name or signature.
- Ask participants to think aloud. Explain that the app is being tested. Read only the task prompt first; success criteria and observation prompts are for the facilitator.
- Preflight the build, connectivity, location access, available free-wash offer, test orders, and contact destinations with Nasser. Use an approved test environment. Do not dispatch a real service or contact an unrelated business. Check contact handoff using an agreed test destination, then stop before sending/calling unless arranged.
- For registration, use the participant's own number privately; confirm they can receive SMS and are not already registered. If already registered, record the deviation rather than deleting their account. Never record phone numbers or OTP values.

## Six tasks

| # | Read aloud | Completion criteria and observations (facilitator only) |
|---|---|---|
| 1 | Create an account with your own number, enter the SMS code, and add your car. | Account created, verification accepted, car added, Home reached. Record SMS request-to-arrival seconds separately from total task time, resend attempts, validation problems, and any assistance. In Expo Go record prototype sign-in and SMS latency as not applicable. |
| 2 | Your battery is dead at CMU-Q. Book a jump start for now. | Selects jump start, vehicle, location, Now, reviews and places the test order. Note hesitation and whether acceptance confirmation is noticed without prompting. |
| 3 | Follow your technician, show how you would contact them, and tell me how you know they have accepted the job. | Opens tracking, interprets status/ETA, finds contact controls, and opens an agreed contact handoff. Record Call and WhatsApp discoverability separately, time to first contact control, and their exact explanation of acceptance. Do not count an absent acceptance event as a participant failure; record the build limitation. |
| 4 | Request a tow, choose a garage, and explain what the displayed price means before continuing. | Chooses towing and destination garage; reaches review and explains estimate versus final price and displayed inclusions. Record their first unprompted interpretation verbatim, displayed wording/breakdown, and any caveats or uncertainty. Judge against what this tested build actually displays. |
| 5 | Use your free car wash. | Finds the offer, sees the free price, and completes the available test booking flow. Record eligibility/availability limitations separately. |
| 6 | Sign out and sign back in to your account. | Signs out, completes the build's verification flow, reaches Home, and sees the same car/account. Record sign-in mode, SMS issues, and missing data. This replaces Sprint 3's close/reopen task. |

## Recording rules

- Record **A = completed alone**, **H = completed with help**, or **F = failed** for each attempted task. Navigation hints count as help; neutral reminders to think aloud do not. Record the exact help given.
- Start timing after reading the prompt; stop at completion or when the participant gives up/the facilitator ends the attempt. Record elapsed seconds for failed tasks too. If timing is missing, leave it missing rather than estimating.
- If an earlier task fails, record its outcome before providing a prepared starting state for later tasks. Record the setup intervention separately; do not let it silently change the earlier score.
- Record screen/action, hesitation, recovery, and exact words. Mark paraphrases as observations, never as quotes.
- If a task cannot start because the build/service is unavailable, mark **NT = not tested**, give the reason, and do not recode it as a user failure. If an attempted task is blocked by an outage, retain F and explicitly tag the technical cause. Disclose missing tasks and mixed build modes.

## Questions after the tasks

1. On a scale of 1 to 5, how easy was it to request help? (1 = very difficult; 5 = very easy.)
2. What, if anything, confused you?
3. Did you trust the price and arrival time shown? Why or why not?
4. Would you use this instead of calling a garage or your insurer? Why?
5. What is missing that you would need in a real breakdown?
6. Did the SMS code arrive quickly? (For prototype-code sessions, mark real SMS not tested.)
7. Was it clear what the towing price includes?

After recording the first responses, clarify where they looked for contact controls, what signalled acceptance, and whether they thought the towing price could change. Keep these follow-up answers separate from unprompted behavior.

## Results - pending real session notes

Participant count: pending. New to Sprint 4: pending. Build/mode and session dates: pending. Minimum sample and newcomer requirement: not yet verified.

| Task | Alone A | Help H | Failed F | Not tested NT | Completed / attempted | Success rate | Average time (seconds; n) |
|---|---|---|---|---|---|---|---|
| 1 Registration + car | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 2 Jump start now | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 3 Tracking + contact | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 4 Towing + garage + price | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 5 Free car wash | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 6 Sign out / sign in | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

Calculation rules, fixed before analysis:

- Attempted total = A + H + F; completed = A + H. Success rate = completed / attempted x 100. Also report independent completion A / attempted x 100.
- Overall completion = sum(A + H) / sum(A + H + F) x 100; do not average task percentages when denominators differ. Show attempted / planned tasks (6 x actual participants) and NT reasons.
- Average task time = sum of recorded elapsed seconds across attempted outcomes / number with recorded time. Report this n, missing times, and include failed attempts. Do not substitute zero for missing times or NT.
- Mean ease = sum of supplied ratings / number of valid ratings; report n and missing responses. An empty denominator is N/A, never 0% or 0/5.
- Report real-SMS and prototype-code results separately where mode affects interpretation. Summarize SMS latency only for actual SMS observations.

Overall completion: pending. Independent completion: pending. Average ease (1-5; n): pending. SMS observations: pending.

### Participant quotes

Pending: select 4-6 short exact excerpts from supplied notes, labelled P1, P2, etc., with task/question references. Do not invent quotes or put paraphrases in quotation marks. If fewer than four usable quotes are recorded, disclose that limitation.

### Comparison with Sprint 3

| Problem | Sprint 3 finding | Sprint 4 evidence | Assessment |
|---|---|---|---|
| Technician contact | Call and WhatsApp easy to miss | Pending: independent discovery, time, hesitation, quotes | Pending: improved / same / worse / inconclusive |
| Towing price | Estimate read as final | Pending: initial interpretation and inclusion explanations | Pending: improved / same / worse / inconclusive |
| Technician acceptance | Clear confirmation requested | Pending: observed confirmation and participant understanding | Pending: improved / same / worse / inconclusive |

Compare cautiously: the participants, implementation, authentication mode, and task 6 differ. Sprint 3 task-level timings and issue counts are unavailable in the brief; do not invent numerical improvements or infer usability from a code change alone.

### Lessons and Sprint 5 recommendations

Pending observations. For each evidence-backed finding, record: **what we saw** (participant IDs/task and frequency with denominator), **why it matters**, and **the recommended change** (plus priority and a concrete way to retest it). Do not present the prior-round concerns as newly observed findings.

## Handoff to Nasser - fill after testing

Summary: "We tested with [actual count] drivers in Qatar, including [count] new participants. [Completed]/[attempted] tasks were completed ([rate]%; [independent rate]% alone); average ease was [rating]/5 (n=[ratings]). Testing used [build and sign-in mode]. The three main findings were [evidence-backed findings]. We recommend [changes for Sprint 5]."

- Branch: `sprint-4-user-testing`; pull request targets `sprint-4`.
- Evidence: one photo/scan of a genuinely filled note sheet, with names, phone numbers, OTPs, plates, and other identifying details hidden. Pending; the blank sheet is preparation material, not session evidence.
- Before finalizing: verify at least 5 actual drivers and 2 newcomers, reconcile every result with raw notes, include 4-6 exact quotes if available, disclose deviations/missing data, and link the redacted evidence. Keep the pull request in draft while results are pending.
