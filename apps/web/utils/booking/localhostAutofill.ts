/**
 * Localhost-only draft for booking autofill.
 * Never runs on findadoc.jp hosts. Files are not stored.
 */

export type BookingAutofillDraft = {
    formId: string
    formVersion: number
    values: Record<string, string>
    startsAt: string | null
    savedAt: string
}

const KEY_PREFIX = 'findadoc.booking.autofill.'

export function isBookingAutofillHost(hostname: string | null | undefined): boolean {
    if (!hostname) {
        return false
    }
    const host = hostname.toLowerCase().split(':')[0] ?? ''
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
}

function storageKey(formId: string): string {
    return `${KEY_PREFIX}${formId}`
}

export function readBookingAutofill(formId: string, hostname: string): BookingAutofillDraft | null {
    if (!isBookingAutofillHost(hostname) || typeof localStorage === 'undefined') {
        return null
    }
    try {
        const raw = localStorage.getItem(storageKey(formId))
        if (raw === null) {
            return null
        }
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null
        }
        const draft = parsed as Partial<BookingAutofillDraft>
        if (draft.formId !== formId || typeof draft.formVersion !== 'number' || typeof draft.values !== 'object'
          || draft.values === null || Array.isArray(draft.values)) {
            return null
        }
        const values: Record<string, string> = {}
        for (const [key, value] of Object.entries(draft.values)) {
            if (typeof value === 'string' && !value.startsWith('data:')) {
                values[key] = value
            }
        }
        return {
            formId,
            formVersion: draft.formVersion,
            values,
            startsAt: typeof draft.startsAt === 'string' && draft.startsAt !== '' ? draft.startsAt : null,
            savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : new Date().toISOString()
        }
    } catch {
        return null
    }
}

export function writeBookingAutofill(
    formId: string,
    formVersion: number,
    values: Record<string, string>,
    hostname: string,
    startsAt: string | null = null
): boolean {
    if (!isBookingAutofillHost(hostname) || typeof localStorage === 'undefined') {
        return false
    }
    const textValues: Record<string, string> = {}
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
        let text = ''
        if (typeof value === 'string') {
            text = value
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            text = String(value)
        }
        if (text.startsWith('data:')) {
            continue
        }
        textValues[key] = text
    }
    const draft: BookingAutofillDraft = {
        formId,
        formVersion,
        values: textValues,
        startsAt,
        savedAt: new Date().toISOString()
    }
    localStorage.setItem(storageKey(formId), JSON.stringify(draft))
    return true
}

export function clearBookingAutofill(formId: string, hostname: string): void {
    if (!isBookingAutofillHost(hostname) || typeof localStorage === 'undefined') {
        return
    }
    localStorage.removeItem(storageKey(formId))
}
