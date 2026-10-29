/**
 * Per-address budgets for the signed-out booking endpoints (#160).
 *
 * The address comes from clientIpFrom, so the count is per person, not per
 * CloudFront edge. Counts live in this process: each API instance keeps its
 * own, as the Maps lookup budget does (places/mapsLink.ts). A refused call
 * is not counted, so a client that retries does not extend its own wait.
 *
 * Mobile carriers in Japan put many people behind one address, so the limits
 * leave room for a few families. The open-request cap per email (bookingService)
 * is what keeps one sender from filling a clinic's calendar.
 */

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

/** Swept for addresses with no recent calls once a budget tracks this many. */
const SWEEP_AT_ADDRESSES = 5000

type Budget = {
    limit: number
    windowMs: number
    hits: Map<string, number[]>
}

function budget(limit: number, windowMs: number): Budget {
    return { limit, windowMs, hits: new Map() }
}

const BUDGETS = {
    // createBookingUploadUrl: one per file field on each attempt.
    upload: budget(20, HOUR_MS),
    // submitBooking.
    submit: budget(10, HOUR_MS),
    // patientBooking and cancelBookingByToken share one budget.
    token: budget(30, 10 * MINUTE_MS)
} as const

export type BookingBudget = keyof typeof BUDGETS

/** Whether this address may make one more call against the budget. A true answer counts the call. */
export function allowBookingCall(name: BookingBudget, ip: string, now = Date.now()): boolean {
    const { limit, windowMs, hits } = BUDGETS[name]
    const recent = (hits.get(ip) ?? []).filter(at => now - at < windowMs)
    if (recent.length >= limit) {
        hits.set(ip, recent)
        return false
    }

    recent.push(now)
    hits.set(ip, recent)
    if (hits.size > SWEEP_AT_ADDRESSES) {
        sweep(hits, windowMs, now)
    }
    return true
}

function sweep(hits: Map<string, number[]>, windowMs: number, now: number): void {
    for (const [ip, times] of hits) {
        if (times.every(at => now - at >= windowMs)) {
            hits.delete(ip)
        }
    }
}
