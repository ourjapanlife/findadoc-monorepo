# Booking access, lifecycle, and forms

To demo or test the whole flow, see [booking-showcase.md](./booking-showcase.md).

Booking is keyed by the directory facility (`facilities.id`). A hosted clinic
page (`clinic_sites`) is optional branding.

## Who sees what

| Who | How | Can |
|---|---|---|
| Moderator, admin | `read:bookings`, `write:clinic_availability`, `write:clinic_memberships` scopes | Every clinic. Invite owners and staff. |
| Clinic owner | `clinic_memberships.role = 'owner'` for the facility | That clinic's requests, calendar, settings, and staff. |
| Clinic staff | `clinic_memberships.role = 'staff'` | That clinic's requests and calendar. |
| Patient | Private token from the confirmation email | Their own booking: view and cancel. |

Owners and staff are plain users with no extra Auth0 role. Their resolvers use
`withAuthenticatedUser`, and every service checks the facility through
`src/booking/access.ts`. Another clinic's booking reads as missing.

### Invites

A moderator (or an owner, for staff) invites an email for a facility. The
first sign-in whose **verified** email matches claims the row and stores the
Auth0 `sub`. The API reads the email from namespaced access-token claims, so
an Auth0 post-login Action must add them:

```js
exports.onExecutePostLogin = async (event, api) => {
  api.accessToken.setCustomClaim('https://findadoc.jp/email', event.user.email)
  api.accessToken.setCustomClaim('https://findadoc.jp/email_verified', event.user.email_verified === true)
}
```

Without those claims no invite is claimed and a clinic member sees no clinics.

## Open times

Open starts are, for one clinic:

1. weekly hours (`clinic_weekly_hours`), set in Dashboard → Settings in Japan
   time: ISO weekday (1 Monday, 7 Sunday) and minutes after midnight JST, on
   30-minute boundaries, ending by midnight;
2. plus painted extra windows (`clinic_availability_windows`);
3. minus closures (`clinic_availability_closures`): a holiday, a day off, or
   one weekly block staff closed on the calendar;
4. minus `requested` and `confirmed` appointments.

Japan has no daylight saving time, so a weekly block is always the same UTC
range. `src/booking/schedule.ts` does the arithmetic. Saving weekly hours
replaces the whole week and joins blocks that overlap or touch. A closure does
not touch an appointment already inside it; staff cancel that one themselves.
Submit still takes the clinic's advisory lock and re-reads open starts inside
it.

### Doctors

Each doctor linked to the facility (`hps_facilities`) may have a schedule of
their own: weekly hours and windows with their `practitioner_id`. Rows without
one are the clinic's schedule. A clinic-wide closure closes every doctor; a
doctor's closure closes only them. An appointment holds time on one schedule
(`booking_appointments.practitioner_id`), so two doctors can each see a
patient at 10:00. A doctor with no rows of their own books on clinic time, and
naming them is a preference the clinic sees on the request.

The Book page lists the clinic's doctors and languages
(`BookingForm.practitioners`, `BookingForm.languages`). The patient picks the
languages they need and a doctor or "any doctor". Only doctors who speak every
chosen language are listed. "Any doctor" searches each matching doctor's
schedule, then clinic time when the clinic covers those languages
(`facilities.supported_languages`, or a doctor on clinic time who speaks them
all). Submit takes the first schedule that still has the start free, inside the
lock, and stores the doctor on the request and the languages in
`booking_submissions.spoken_languages`. `src/booking/practitioners.ts` holds
these rules.

Staff pick the schedule they edit (whole clinic or one doctor) in Settings →
Weekly hours and on the calendar.

On the calendar, a click on a weekly block closes that one occurrence. In
**Close time** mode, a drag closes a range and the all-day row closes whole
Japan days. A click on a closed range reopens it. Every change offers Undo.

## Appointment lifecycle

```
requested ──confirm──▶ confirmed ──complete──▶ completed
    │                      │
    ├──decline──▶ declined │
    └──cancel───▶ cancelled ◀──cancel (staff or patient)
```

`requested` and `confirmed` hold the slot. Every change is a compare-and-set on
the current status. The patient may cancel until the visit starts. Each change
emails the other side.

The patient token is 32 random bytes in the URL fragment of
`/book/manage#{token}`, so it is never in a server or CDN log. Only its sha256
is stored (`booking_submissions.cancel_token_hash`).

## Only visitors in Japan

Booking is offered only to people who are in Japan now (#173). A request
carries health information and identity documents, and keeping booking to
visitors in Japan keeps it under the APPI rather than the GDPR's rules for
special-category data. The directory, clinic pages, and the patient's manage
link (`patientBooking`, `cancelBookingByToken`) stay open everywhere.

`src/booking/region.ts` reads the viewer's country from CloudFront's
`CloudFront-Viewer-Country`. The edge function copies it to
`x-findadoc-viewer-country`, and `viewerCountryFrom` trusts it only with the
edge secret, as `clientIpFrom` does for the address. `submitBooking` and
`createBookingUploadUrl` refuse anything but `JP`, including a missing
country, with `BOOKING_REGION_UNAVAILABLE` (HTTP 403). The `bookingAvailable`
query gives the Book page the same answer, and the page shows a notice with
the clinic's contact details instead of the form. Local development and tests
have no CloudFront, so they skip the check.

A VPN changes the country, so the patient also ticks "I am currently in
Japan". A second box consents to the reason for the visit going to the
clinic. `submitBooking` requires both (`confirmedInJapan`,
`healthDataConsent`) and stores the consent time in
`booking_submissions.health_data_consented_at`.

## Limits on the signed-out endpoints

The intake form and the patient link work without a session, so
`src/booking/rateLimits.ts` limits them per client address (`clientIpFrom`):

| Budget | Calls | Per address |
|---|---|---|
| `upload` | `createBookingUploadUrl` | 20 an hour |
| `submit` | `submitBooking` | 10 an hour |
| `token` | `patientBooking`, `cancelBookingByToken` | 30 every 10 minutes |

A refused call answers `TOO_MANY_REQUESTS` and is not counted. The counts are
in memory, one set per API instance, like the Maps lookup budget. They are
generous because one mobile-carrier address can be many people.

One email may hold 3 upcoming `requested` appointments at one clinic
(`MAX_OPEN_REQUESTS_PER_EMAIL`, case-insensitive). A fourth answers
`OPEN_REQUEST_LIMIT` until the clinic answers one, or one ends or is
cancelled. The count runs inside the clinic's booking lock.

An upload URL that is never submitted leaves an unclaimed row. The daily
purge deletes it and its object after 24 hours (booking-retention.md), so one
address can leave at most a day of upload budget behind.

## Forms

`src/booking/formDefinitions.ts` holds every form type. A clinic offers one or
more through `booking_settings.form_definition_ids`; the first is its default.
`?form=` on the Book URL picks another form the clinic offers. Submit and
upload reject a form the clinic does not offer. A later clinic-authored form
only needs to return the same `FormSource` shape from `formSourceById`.

## Dashboard

`/clinic-dashboard/{facilityId}` on the Find a Doc site. A clinic hostname's
`/dashboard` redirects there, because the Auth0 session lives on one origin.
