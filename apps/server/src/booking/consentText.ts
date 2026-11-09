/**
 * The health-data consent wording a patient agrees to on the Book page (#173, spec §6).
 *
 * The wording itself lives in the web locale files under bookingPage.healthDataConsent. Each
 * version is frozen in docs/consent-text/{version}.md in English and Japanese, and
 * __tests__/consentText.test.ts fails when the locale strings drift from the current copy.
 * Changing the wording means a new frozen file and a new version here, never an edit to an
 * old file.
 *
 * The server stamps this version on booking_submissions.consent_text_version. The client does
 * not send it, so a stale tab cannot claim a wording the server does not know.
 */
export const CURRENT_CONSENT_TEXT_VERSION = '2026-11-08'

/** Every version that has a frozen copy, oldest first. 2026-10-30 is the #173 wording. */
export const CONSENT_TEXT_VERSIONS = ['2026-10-30', CURRENT_CONSENT_TEXT_VERSION] as const

export type ConsentTextVersion = typeof CONSENT_TEXT_VERSIONS[number]
