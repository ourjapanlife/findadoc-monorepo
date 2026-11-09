# Health data consent wording

Each file here is the exact consent wording a booking patient agreed to, in
English and Japanese, named by its version. `booking_submissions.consent_text_version`
holds that name. A null version is a request sent before versions were stored;
`health_data_consented_at` places it (null time: before #173, otherwise
`2026-10-30`).

Do not edit a file once it has shipped. New wording gets a new file, a new
`CURRENT_CONSENT_TEXT_VERSION` in `src/booking/consentText.ts`, and the new
locale strings under `bookingPage.healthDataConsent` in every file in
`apps/web/i18n/locales`. `__tests__/consentText.test.ts` fails when the English
or Japanese locale string differs from the current file.

The other 11 locales are translations of the English text. They are not frozen
here.

| Version | Change |
|---|---|
| [2026-10-30](2026-10-30.md) | #173: consent to send the reason for the visit to the clinic. |
| [2026-11-08](2026-11-08.md) | Spec §6: names current symptoms and past illnesses, and the clinic as the only recipient. |
