# Return to Hoops: setup

A workout tracker for getting back to dunking. It lives on your iPhone home screen, works with no signal at the gym, and is free to run. It's set up the same way as Shea's Log: hosted on **GitHub Pages**, with optional cloud backup through a free **Firebase** project.

There are three parts. Part 1 happens once, Part 2 takes two minutes on your phone, and Part 3 is optional but recommended.

---

## Part 1: Put the app online (GitHub Pages, free)

Unlike Shea's Log, this app has a build step. You don't upload files by hand; GitHub builds the app each time new code is pushed.

1. Sign in at <https://github.com> as **gj-ship-it-1584**.
2. Click **+** (top right) → **New repository**.
   - Name: `Return-To-Hoops`
   - **Public**
   - Do **not** tick "Add a README" (the repository must start empty).
   - Click **Create repository**.
3. Tell Claude "push it". Claude pushes the code from this folder, the same way as Shea's Log.
4. On the repository page, click **Settings** → **Pages** (left sidebar). Under **Build and deployment → Source**, choose **GitHub Actions**. You only do this once.
5. Click the **Actions** tab. A run called "Deploy to GitHub Pages" builds the app, which takes about 2 minutes. When it shows a green check, the app is live at:

   **https://gj-ship-it-1584.github.io/Return-To-Hoops/**

To update the app later, say "push it" again. Your phone picks up the new version the next time you open the app.

> **What's public:** the repository and site are public, as with Shea's Log. They contain only the app and the training plan. Your workouts, weight and labs never go to GitHub; they stay on your phone (and in your Firebase project if you turn on Part 3). Your baseline blood work arrives through the private link in Part 2, not through the code.

---

## Part 2: Install on your iPhone

1. Find **`my-setup-link.txt`** in this folder (it is never uploaded to GitHub). It contains one long link that carries your November 2026 baseline labs inside the link itself.
2. Send that link to yourself in a way that keeps it private, such as a note to yourself or AirDrop. Open it **in Safari** on the iPhone.
3. **While that page is open**, tap **Share → Add to Home Screen → Add**.
   As with Shea's Log, a home-screen app keeps its own storage, separate from Safari. Adding it from the setup link means the home-screen copy loads your baseline the first time you open it.
4. Open **Hoops** from the home screen. Then:
   - **Settings → Standing reach**: measure it once (instructions on that screen). This drives the dunk and vertical math.
   - **Settings → Program start date**: defaults to the first Monday, which is today, Nov 16. Change it if you want to start later.
   - **Body → Labs**: check the baseline is there and fix the draw date (it's set to Nov 1).
5. Test it in airplane mode: turn on airplane mode, close the app, open it again. It should open normally and let you log a workout.

---

## Part 3: Cloud backup (Firebase, free, recommended)

Without this, your data lives only on the phone. iPhone can clear website storage in rare cases, and a lost phone means lost data. Firebase keeps a live copy in the cloud, which you can also open on another device.

**Easiest: reuse the Firebase project you made for Shea's Log.** The two apps keep their data in separate areas of the same database (`families/…` for Shea, `athletes/…` for Hoops).

1. Go to <https://console.firebase.google.com> and open your **shea-log** project.
2. **Build → Firestore Database → Rules**. Replace the rules with this version, which keeps Shea's rule and adds one for Hoops, then click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /families/{family}/{document=**} {
         allow read, write: if family.size() >= 20;
       }
       match /athletes/{code}/{document=**} {
         allow read, write: if code.size() >= 20;
       }
     }
   }
   ```

3. Click the **gear ⚙︎ → Project settings**, scroll to **Your apps**, and copy the `const firebaseConfig = { … };` block. This is the same block you pasted into Shea's Log.
4. In Hoops on your iPhone: **Settings → Cloud backup and sync**. Paste the block, leave **Code** blank (the app makes a long random one), and tap **Connect**. The status changes to **Connected · live**.
5. Tap **Share the setup link** and open that link in Safari. **While it's open**, do Share → Add to Home Screen again. Delete the old icon afterwards. The new icon remembers the Firebase connection, which is the same reason Shea's Log uses invite links.

(Prefer a separate project? Create a new Firebase project called `return-to-hoops` exactly as in Shea's Log's SETUP.md Part 2, and use the `athletes` rule above.)

---

## Everyday use

- **Today** shows the week, phase and effort cue, plus what to do: Vertical + legs on Monday, Upper body on Wednesday, Lateral + conditioning on Friday. Court day is optional on Saturday or Sunday. Easy cardio is optional on Tuesday and Thursday. Other days show a 5-minute desk reset plus a dog walk.
- **Missed a day?** Lifting days run in order: Vertical + legs → Upper body → Lateral + conditioning. If you skip Monday, Wednesday shows Vertical + legs again, not Upper body. **Pick a different session** lets you start anything.
- **Start workout** walks you through the warm-up, then each exercise:
  - Each card shows today's sets × reps and what you did last time. The inputs are pre-filled; tap ✓ to log a set.
  - A rest timer starts after each set: 150 s for main lifts, 75 s for everything else. Use **+30 s** or **Skip**.
  - On iPhone the timer beeps and flashes the screen but can't vibrate (Apple blocks web apps from vibrating). With the screen locked it can't alert you, but it shows the right time remaining when you unlock.
  - If you don't hear the beep, check the ring/silent switch: some iOS versions mute web audio on silent.
- **Swap** on any card shows alternatives for that movement. Pick **Just today** or **Rest of this cycle**. Your numbers are kept for each exercise separately, so switching back later shows your old weights.
- **Finish** asks for the pain check (shoulder, hamstring, knee, Achilles). Anything above 3 shows what to do.
- **History** lists every workout, cardio session and weigh-in, newest first. Tap a workout to fix a weight or rep, add or remove a set (✕), change the date or length, edit the pain check, or delete it. Tap a cardio or body entry to edit or delete it. **+ Past workout** logs a session you forgot to record.
- **Schedule** (Today → This week → Schedule, or tap any day in the week strip): every upcoming day with its moves and this week's sets and reps. On any day you can **Change** the workout (move Upper body to Thursday, make it a rest day…), **+ Add a workout**, or **Swap** a move for that day only or for the rest of the cycle. Lifting days still run in order, so moving one shifts the ones after it. Changed days show a gold dot.
- **+ Add to this day** (on any day in the Schedule, or "Add to or change today"): one searchable list of activities (basketball, run, walk, hike, swim, yoga, tennis, golf or your own), workouts, and single exercises. On today or a past day an activity is logged; on a future day it is planned and Today offers **Log it** when the day comes. Basketball counts toward your weekly sessions.
- **Cardio today** (on Today and every day in the Schedule): minutes against your daily goal (60 by default). Dog walks, incline walks, bike, rower and basketball all count. **+ Dog walk** and **+ Other cardio** log it in a tap; change the goal in Settings → Daily targets.
- **Reorder** (on a workout, or on any planned day in the Schedule): press and drag the ⠿ handle to change the exercise order. Tick "Use this order every time" to make it your default for that training day. The warm-up stays first and the prehab circuit last.
- **Add an exercise** to any workout: during a session (bottom of the list), when editing one in History, or ahead of time on any day in the Schedule. Search or browse the library, set sets and reps, and it shows up with its own card, last-time numbers and rest timer. **Remove** takes it off again.
- **Library** tags every move with the day it's on ("Vertical + legs · wk 4–5"), and the chips filter by day.
- **Settings** is the gear at the top right of Today.
- **Body**: weight, waist (every 2 weeks), optional sleep, calories, protein and steps; **Labs**; **Cardio** and dog walks.
- **Trends**:
  - Dunk tracker at the top: inches to go to a 10′6″ touch.
  - Weight with a 7-day average and your weekly rate. If the rate is off for 2 weeks, it offers the ±150 calorie change.
  - Also strength, jumps, cardio, consistency streak, conditioning, shooting, pain and labs.
- **Backups**: **Settings → Export all data** saves one file to Files or AirDrop, and **Import** restores it exactly. If Firebase isn't connected, Today reminds you after 14 days.

## For Claude (maintenance notes)

- Plan content: `src/plan/days.ts` (prescriptions), `src/plan/phases.ts`, `src/plan/content.ts` (slots, safety copy, labs), `src/plan/exercises/*.ts` (library and diagrams).
- Check diagrams: `npx tsx scripts/preview-diagrams.ts out.png <ids or file names>`.
- Tests: `npm test`. Build: `npm run build`. Regenerate the private link: `npx tsx scripts/make-setup-link.ts`.
