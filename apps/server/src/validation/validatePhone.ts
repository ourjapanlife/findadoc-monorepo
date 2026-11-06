import { isValidJapanPhone, toJapanE164 } from '../../utils/stringUtils.js'

/** Longest phone text the API will read. A real number with spacing is well under this. */
const PHONE_INPUT_MAX = 40

/**
 * True when a facility phone parses as a Japanese number. Any spacing, hyphens, or full-width
 * digits are fine; a foreign number, an extension, or a note is not.
 */
export function isStorablePhone(phone: string): boolean {
    return phone.length <= PHONE_INPUT_MAX && isValidJapanPhone(phone)
}

/**
 * The value written to `contact.phone`: E.164 (`+81312345678`) so it dials from any SIM.
 *
 * An empty phone stays empty. A value that does not parse is returned trimmed and unchanged:
 * validation has already refused it on input, so this only happens for a stored legacy row that
 * a write carries over untouched. The backfill reports those ids (`backfillFacilityPhones.ts`).
 */
/**
 * True when a contact update may keep this phone: a storable number, or the exact value already
 * stored on the facility. The moderation form resends the stored phone whenever another contact
 * field changes, so an unparseable legacy row must not block an unrelated edit. A new value that
 * does not parse is still refused.
 */
export function isAcceptedUpdatePhone(phone: string, storedPhone: string | null | undefined): boolean {
    if (isStorablePhone(phone)) {
        return true
    }
    const stored = (storedPhone ?? '').trim()
    return stored !== '' && phone.trim() === stored
}

export function phoneForStorage(phone: string | null | undefined): string {
    const trimmed = (phone ?? '').trim()
    if (trimmed === '') {
        return ''
    }
    return toJapanE164(trimmed) ?? trimmed
}
