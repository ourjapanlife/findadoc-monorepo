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

## Forms

`src/booking/formDefinitions.ts` holds every form type. A clinic offers one or
more through `booking_settings.form_definition_ids`; the first is its default.
`?form=` on the Book URL picks another form the clinic offers. Submit and
upload reject a form the clinic does not offer. A later clinic-authored form
only needs to return the same `FormSource` shape from `formSourceById`.

## Dashboard

`/clinic-dashboard/{facilityId}` on the Find a Doc site. A clinic hostname's
`/dashboard` redirects there, because the Auth0 session lives on one origin.
