# Booking: full flow, showcase, and test runbook

How booking works end to end, how to demo it on the multilingual online clinic
(`multilingual-online-clinic`), and what to check when testing. The rules
behind it are in [booking-access.md](./booking-access.md).

Showcase ids:

| | |
|---|---|
| Clinic subdomain | `multilingual-online-clinic` |
| Facility id (the Book and dashboard id) | `c32c316a-a368-499b-abaf-c5c973cb67e5` |
| Clinic site id | `a303a8ac-31c9-45d8-96d1-cf6630aa11bd` |
| Forms it offers | `showcase-intake-v1` (online consult: contact, visit, insurance card, photo). The local seed also offers `findadoc-intake-v1`. |

---

## 1. The whole flow

```
PATIENT (signed out)                     CLINIC (signed in)                 EMAIL
────────────────────                     ──────────────────                 ─────
Clinic page → Book
  /book/{facilityId}
Pick length + open time
Fill the form, upload files
Submit ───────────────▶ appointment = REQUESTED (slot held)         ──▶ patient: "We received your request" + manage link
Success screen shows                                                ──▶ clinic: "New appointment request"
  the private manage link
                                         Dashboard → Requests
                                         Open the request
                                         Confirm ──▶ CONFIRMED              ──▶ patient: "Your appointment is confirmed"
                                           or Decline (+note) ──▶ DECLINED  ──▶ patient: "…declined" + note   (slot freed)
                                           or Cancel (+note) ──▶ CANCELLED  ──▶ patient: "…cancelled" + note  (slot freed)
Open the manage link
  /book/manage#{token}
Cancel (+reason) ─────▶ CANCELLED by the patient (slot freed)       ──▶ clinic: "Cancelled by the patient"
                                         After the visit:
                                         Mark completed ──▶ COMPLETED
```

- **`requested` and `confirmed` hold the time.** As soon as a request is declined or cancelled, the time is offered on the Book page again.
- A patient can cancel until the visit starts. A closed appointment (declined, cancelled, completed) can't be reopened.
- **The manage link works without email.** It is on the success screen, and the same link is in the confirmation email. Anyone with the link can view and cancel that one booking, so treat it like a password.
- Who can open the dashboard: moderators and admins see every clinic. Clinic owners and staff see their own clinic once they're invited and sign in (needs #158).

## 2. Email today: SES is in the sandbox

SES only delivers to **verified** addresses until AWS grants production access (#157).

| Where you run it | What happens to booking emails |
|---|---|
| Local (`SES_FROM_ADDRESS` not set) | Nothing is sent. The API terminal logs `Booking email logged` with the full `textBody`, including the manage link. |
| Production, recipient **verified** in SES | Delivered. |
| Production, recipient **not verified** | SES rejects it. The booking is still saved, the request still shows in the dashboard, and the submission's email status shows **Notify failed**. The patient still has the manage link from the success screen. |

So the whole flow works without email. Email is only one of the ways people are told.

**To have emails arrive during a production demo**, verify every address that should receive mail. In the AWS console, go to **SES** (`ap-northeast-1`) → **Identities** → **Create identity** → **Email address**. The address's owner clicks the link AWS sends. Verify:

- the patient email you will type into the form, and
- the clinic inbox: **invite your own address as a member of the showcase clinic** (Dashboard → Settings → Team). Member emails get clinic notices first, and this works even before the invite is claimed. Without a member, notices go to the directory contacts for that facility (#161), which in the sandbox just bounce.

## 3. Where to run the demo

| | Local laptop | Production (`findadoc.jp`) |
|---|---|---|
| Works today | Yes, on this branch | Only after #153 is merged and deployed |
| Open times | Seeded: weekdays 09:00–12:00, 13:00–17:00 JST, next 14 days | A moderator paints them on the calendar |
| Emails | Printed in the API terminal | Real, verified addresses only |
| Sign-in | Real Auth0, **Moderator or Admin account** | Same |
| Risk | Laptop has to run the stack | Real data; demo bookings stay in the database unless cancelled |

**Recommendation for tomorrow: run it locally.** It doesn't depend on a deploy or on SES, and you can show the emails in the API terminal. Use production only if #153 is deployed tonight and you have time to rehearse there.

## 4. Night-before setup: local

From the repo root, on this branch.

1. **Free port 54322.** Your old local Supabase stack still holds it (`supabase_db_findadoc-server`), and `pnpm dev:seeded` **resets whatever database answers on 54322**. Stop that stack (its data is kept, just not running):
   ```bash
   docker stop $(docker ps -q --filter "name=_findadoc-server")
   ```
   Check that nothing else is on the port: `docker ps --format '{{.Names}} {{.Ports}}' | grep 54322` should print nothing.
2. **Start everything with fresh demo data.**
   ```bash
   nvm use
   corepack enable
   corepack prepare pnpm@10.27.0 --activate
   pnpm dev:seeded
   ```
   This starts the `findadoc-db` container, applies every migration, seeds the directory and the showcase clinic, opens its weekday hours for the next 14 days, and runs the site on `http://localhost:3000` and the API on `http://127.0.0.1:4000`. **Seed the night before or the morning of**, because the hours start from the day you seed.
3. **Two browser windows:**
   - **Patient window**: a private or incognito window, signed out.
   - **Clinic window**: a normal window. Sign in at `http://localhost:3000` with a **Moderator or Admin** account (ask a core maintainer on Slack if you don't have one). Local runs use real Auth0; there is no auth bypass.
4. **Unlock the clinic page.** It's in preview, and the preview cookie is per host. In **both** windows open
   `http://multilingual-online-clinic.localhost:3000/?preview=1` once.
5. **Rehearse sections 6 and 7 once.** Then reset (section 9) so the demo starts clean.

## 5. Night-before setup: production (only if #153 is deployed)

1. `pnpm db:push` has applied `20261029150000_booking_access_lifecycle.sql`.
2. As a moderator, open `https://www.findadoc.jp/clinic-dashboard/c32c316a-a368-499b-abaf-c5c973cb67e5` → **Calendar** and drag to paint open hours for tomorrow and the next few days. Without this the Book page says there are no times.
3. **Settings → Team**: invite your own email (role Owner). Notices for the showcase then go to you.
4. Verify in SES (section 2) your email and the demo patient email.
5. Open `https://multilingual-online-clinic.findadoc.jp/?preview=1` in both windows.
6. Rehearse, then cancel the rehearsal bookings so their times free up.

## 6. Demo script (about 10 minutes)

Replace `localhost:3000` with `www.findadoc.jp` (and `.localhost:3000` with `.findadoc.jp`) on production.

**Act 1: a patient books (patient window)**

1. Open `http://multilingual-online-clinic.localhost:3000/`. *"This is a clinic's own page on its subdomain."* Switch the language to show it's multilingual.
2. Click **Book**. You land on Find a Doc: `localhost:3000/book/c32c316a-…`. *"Booking always happens on Find a Doc, so the patient sees one trusted flow for every clinic."*
3. Choose **30 minutes** and a time tomorrow. Fill **Contact** (use an email you can show), **Visit**, and **Documents** (any small JPG/PNG/PDF for the insurance card and photo). Submit.
4. The success screen shows the reference and **View or cancel this request**. *"No account needed. This private link is also emailed."* Keep this tab open.
5. Go back to the Book page: that time is gone. *"The slot is held while the clinic decides."*

**Act 2: the clinic responds (clinic window)**

6. Open `http://multilingual-online-clinic.localhost:3000/dashboard`. It redirects to `localhost:3000/clinic-dashboard/c32c316a-…`. *"The clinic's own subdomain takes staff to their dashboard."*
7. **Requests** (filtered to *Requested*): open the new request. Show the answers, and download the insurance file. *"Identity documents are kept for 30 days, then purged."*
8. Click **Confirm**. Status becomes *Confirmed*.
9. **Calendar**: the appointment is green on top of the clinic's open hours. Drag to add an hour; click an empty block to remove it. Click the appointment to jump back to the request.
10. Locally, show the API terminal: the two `Booking email logged` entries (patient receipt, clinic notice) and the *confirmed* email.

**Act 3: the patient cancels (patient window)**

11. Open the manage link (refresh the tab). It now says **Confirmed**. Click **Cancel this appointment**, give a reason, confirm.
12. Clinic window → refresh the request: *Cancelled · by the patient* with the reason. The Book page offers that time again.

**Act 4: forms and settings, "built for many clinics" (clinic window)**

13. **Settings**: tick **15 minutes** off and save, then show the Book page no longer offers 15 minutes.
14. **Intake forms**: the clinic offers several form types and picks a default. Locally the showcase offers both. Open `localhost:3000/book/c32c316a-…?form=findadoc-intake-v1` to show the shorter standard form. *"Find a Doc provides the forms; each clinic chooses which ones it uses. Clinic-written forms come next (#166)."*
15. **Team**: invite a staff email. *"Staff see this clinic only, never another clinic's patients."*

**Optional: decline**

16. Book again as the patient, then **Decline** with a note ("Fully booked that morning"). The time is freed, and the patient email in the terminal includes the note.

## 7. Test checklist

Run these before the demo. Expected results assume the local seed.

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Subdomain Book | Clinic page → Book (header and the Book section) | Lands on `/book/c32c316a-…` with the clinic's name and colour |
| 2 | Open times | Pick 15, 30, 45, 60 min | Only weekday times 09:00–12:00 and 13:00–17:00 JST that fit the whole visit; 60 min never crosses the lunch break |
| 3 | Required fields | Press Next with an empty required field | Stays on the step with an error |
| 4 | Upload types | Upload a `.txt` or a file over 8 MB | Rejected with a message |
| 5 | Submit | Complete and submit | Success screen with the manage link; API logs 2 emails |
| 6 | Slot held | Book page again, same length | That start (and overlapping starts) are gone |
| 7 | Double booking | Two patient windows pick the same time; submit both | Second gets a submit error and is not booked; only one request appears in the dashboard |
| 8 | Confirm | Dashboard → request → Confirm | *Confirmed*; patient email logged; calendar shows green |
| 9 | Stale click | Two clinic windows on the same request; Confirm in both | Second shows "could not update… latest status shown" |
| 10 | Decline | New booking → Decline with a note | *Declined*; slot back on the Book page; note in the patient email |
| 11 | Clinic cancel | Confirmed booking → Cancel appointment | *Cancelled · by the clinic*; slot freed |
| 12 | Patient cancel | Manage link → Cancel with a reason | *Cancelled · by the patient* in the dashboard, reason shown; clinic email logged; slot freed |
| 13 | Closed is closed | Manage link of a cancelled booking | Shows *Cancelled*, no cancel button |
| 14 | Bad link | `/book/manage#nonsense` | "We could not find this booking" |
| 15 | Complete | Confirmed booking → Mark completed | *Completed*, no more buttons |
| 16 | Calendar edit | Drag to paint, click to remove | Block appears/disappears; Book page follows |
| 17 | Long visit | Paint two touching 30-min blocks on an empty day | A 60-min visit can start at the first block |
| 18 | Settings | Untick 15 min, change default form, save | Book page follows both |
| 19 | `?form=` | `?form=findadoc-intake-v1`, then `?form=nope` | Standard form; unknown id falls back to the default |
| 20 | Signed out dashboard | Patient window → `/clinic-dashboard/c32c316a-…` | Sign-in screen, no data |
| 21 | Moderation view | `/my-page?view=bookings` | List shows clinic · patient name and appointment status |
| 22 | Languages | Book in Japanese and one other language | All new screens translated; the manage link keeps the language |

Clinic-member tests (owner and staff only see their clinic, invite claiming) need the Auth0 Action (#158). Until then, test as a moderator. To try an owner locally anyway, attach your Auth0 user id directly (local database only):

```sql
-- docker exec -it findadoc-db psql -U postgres
INSERT INTO clinic_memberships (facility_id, invited_email, auth0_sub, claimed_at, role)
VALUES ('c32c316a-a368-499b-abaf-c5c973cb67e5', 'you@example.com', '<your Auth0 sub, e.g. google-oauth2|123>', now(), 'owner');
```

Sign in with a plain (non-moderator) account with that sub. You see only the showcase clinic. Any other `/clinic-dashboard/{id}` says you don't have access.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm db:start`: "port is already allocated" | Old Supabase stack on 54322 | Section 4 step 1 (#168) |
| Book page: no times | No open hours in range | Re-seed locally, or paint on the calendar |
| Clinic subdomain doesn't show the clinic page | Preview cookie missing on that host | Open `…/?preview=1` once in that window |
| Dashboard: "This account is not linked to a clinic yet" | Plain account and no claimed membership | Use a Moderator account, or the SQL above; production needs #158 |
| Dashboard keeps showing "Sign in" | Auth0 session is per origin | Sign in on `localhost:3000` / `www.findadoc.jp`, not the clinic subdomain |
| Request shows **Notify failed** | SES rejected an unverified recipient (sandbox) | Expected; verify the address in SES, or use the manage link |
| No email in production | Sandbox, or the address isn't verified | Section 2 |
| Times look shifted | Calendar uses your computer's time zone (#163) | Set your computer to Japan time for the demo |
| Can't find the manage link later | It's only shown once and emailed | Locally: API terminal, `Booking email logged` → `textBody` |

## 9. Reset between runs

- **Local**: stop the dev servers and run `pnpm dev:seeded` again. This wipes and re-seeds the local database, including fresh open hours.
- **Production**: cancel demo bookings from the dashboard (that frees their times). Rows are kept for the record. Remove painted hours you don't want by clicking them.

## Known gaps

SES sandbox (#157), Auth0 email claims (#158), scheduled identity-file purge (#159), rate limits (#160), notice fallback to directory contacts (#161), weekly opening hours (#162), calendar time zone (#163), localised emails (#164), dashboard in navigation (#165), clinic-authored forms (#166), browser tests (#167), hard-coded local DB port (#168), facility delete message (#169).
