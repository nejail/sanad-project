# Sprint 4 prompt for Mohammed (user testing round 2)

Copy everything below the line into Claude (Claude Code or Cowork with the repo folder connected).

---

You are helping me (Mohammed Al-Marri, Andrew ID mrmarri) deliver my Sprint 4 feature for **SANAD**, our team's React Native app for 67-443 Mobile Applications at CMU-Qatar. SANAD lets drivers in Qatar book car services (battery, fuel delivery, car wash, tires, oil change, emergency towing) and track the technician.

## Repo and branch

- Repo: https://github.com/nejail/sanad-project.
- Start from the `sprint-4` branch: `git fetch && git checkout sprint-4 && git checkout -b sprint-4-user-testing`.
- When done, push the branch and open a pull request into `sprint-4`.
- Commit messages must not mention Claude or AI, and must not add a Co-Authored-By line.

## My Sprint 4 deliverable (promised in the Sprint 3 report)

**Conduct and document further prototype user testing.**

In Sprint 3 we tested with 5 drivers (28 of 30 tasks completed, ease 4.4 out of 5). The lessons were:

1. Technician contact (Call and WhatsApp buttons on Track Order) was easy to miss.
2. The towing estimate was read as a final price.
3. Drivers wanted a clear confirmation when a technician accepts.

This round checks the **first version of the app**, including the new real SMS sign-in (Firebase), and re-checks those three problem areas.

## Important: only real data

All results, numbers and quotes in the write-up must come from sessions I actually run. Do not invent participants, results or quotes. Help me prepare the materials, then turn my notes into the report. If something is missing from my notes, ask me instead of filling it in.

## Steps

1. **Update the test plan** (`docs/user-test-plan.md`) into a new file `docs/user-testing-sprint4.md` with:
   - At least 5 participants who drive in Qatar, including at least 2 who did not take part in Sprint 3.
   - Tasks: (1) register with your own number using the SMS code and add your car, (2) book a battery jump start now, (3) track the technician and contact them, (4) request a tow, choose a garage, and explain what the price means, (5) use the free car wash, (6) sign out and sign back in.
   - Measures per task: completed alone, completed with help, or failed; time on task; where they hesitated.
   - After the tasks: ease rating 1 to 5, and the questions from the Sprint 3 plan, plus "Did the SMS code arrive quickly?" and "Was it clear what the towing price includes?".
2. **Prepare a printable note sheet** (one page per participant) and a consent line ("Notes are anonymous and used only for a course project").
3. **Run the sessions** with Nasser's development build (sign in with real SMS) on a phone. If the development build is not available, use Expo Go and note that sign-in used the prototype code.
4. **Send my raw notes** to you (Claude). Turn them into:
   - A results table: task, completed / total, success rate, average time.
   - Overall completion rate and average ease rating.
   - 4 to 6 short participant quotes (exact words from my notes, labelled P1, P2, ...).
   - Comparison with Sprint 3: did the three problem areas improve, stay the same, or get worse?
   - Lessons learned and recommended changes for Sprint 5, each with: what we saw, why it matters, and the change.
5. **Commit** `docs/user-testing-sprint4.md` and push the branch.

## What to give back to Nasser at the end

1. A short summary for the Sprint 4 report: number of participants, completion rate, ease rating, the top 3 findings, and the recommended changes.
2. The branch name.
3. A photo or scan of one filled note sheet (names hidden) as evidence.
