/**
 * The old per-professional insurance codes (#18). 380 of 400 professionals in the
 * 18 Sep snapshot carried JAPANESE_HEALTH_INSURANCE and UNINSURED together. That pair
 * was a form default, not a reviewed fact.
 *
 * The fact that stays is on the facility: does the clinic take Japanese public
 * insurance, yes, no, or unknown. The migration marks every existing facility yes.
 * This module only plans the clean-up of the old codes. It never writes a facility
 * value. A moderator marks a self-pay-only clinic no.
 */

export const OldInsuranceCode = {
    JapaneseHealthInsurance: 'JAPANESE_HEALTH_INSURANCE',
    Uninsured: 'UNINSURED',
    InternationalHealthInsurance: 'INTERNATIONAL_HEALTH_INSURANCE',
    TravelInsurance: 'TRAVEL_INSURANCE',
    InsuranceNotAccepted: 'INSURANCE_NOT_ACCEPTED'
} as const

const CODE_SENTENCES: Record<string, string> = {
    [OldInsuranceCode.JapaneseHealthInsurance]: 'Takes Japanese health insurance',
    [OldInsuranceCode.Uninsured]: 'Sees uninsured / self-pay patients',
    [OldInsuranceCode.InternationalHealthInsurance]: 'Takes international health insurance',
    [OldInsuranceCode.TravelInsurance]: 'Takes travel insurance',
    [OldInsuranceCode.InsuranceNotAccepted]: 'Does not accept insurance'
}

export type InsuranceShape = 'dual_default' | 'japanese_only' | 'uninsured_only' | 'other'

export type StoredInsuranceFacility = {
    name: string
    city: string | null
    japaneseInsurance: string | null
}

export type StoredInsuranceRow = {
    acceptedInsurance: unknown
    facilities: readonly StoredInsuranceFacility[]
}

export type StoredInsurancePlan =
    | { action: 'keep' }
    | {
        action: 'clear'
        shape: InsuranceShape
        sentences: string[]
        recommendation: string
    }

/** A stored jsonb list may come back as an array or a JSON string. Anything else is empty. */
export function storedCodes(value: unknown): string[] {
    let stored = value

    if (typeof stored === 'string') {
        try {
            stored = JSON.parse(stored)
        } catch {
            return []
        }
    }

    if (!Array.isArray(stored)) {
        return []
    }

    return [...new Set(stored.filter((code): code is string => typeof code === 'string'))]
}

export function insuranceSentence(code: string): string {
    return CODE_SENTENCES[code] ?? `Unrecognised code ${code}`
}

export function insuranceShape(codes: readonly string[]): InsuranceShape {
    const set = new Set(codes)

    if (set.size === 2
        && set.has(OldInsuranceCode.JapaneseHealthInsurance)
        && set.has(OldInsuranceCode.Uninsured)) {
        return 'dual_default'
    }
    if (set.size === 1 && set.has(OldInsuranceCode.JapaneseHealthInsurance)) {
        return 'japanese_only'
    }
    if (set.size === 1 && set.has(OldInsuranceCode.Uninsured)) {
        return 'uninsured_only'
    }

    return 'other'
}

function facilitySentence(value: string | null): string | null {
    if (value === 'ACCEPTED') {
        return 'the clinic is marked as taking Japanese public insurance'
    }
    if (value === 'NOT_ACCEPTED') {
        return 'the clinic is marked as self-pay only'
    }

    return null
}

/**
 * Every stored code is cleared. The facility is never changed from the codes.
 * An old INSURANCE_NOT_ACCEPTED on a clinic marked yes is flagged for a moderator.
 */
export function planStoredInsurance(row: StoredInsuranceRow): StoredInsurancePlan {
    const codes = storedCodes(row.acceptedInsurance)

    if (codes.length === 0) {
        return { action: 'keep' }
    }

    const shape = insuranceShape(codes)
    const marked = row.facilities
        .map(facility => facilitySentence(facility.japaneseInsurance))
        .filter((sentence): sentence is string => sentence !== null)
    const codesText = shape === 'dual_default' ? 'Clear both codes' : 'Clear the codes'
    const facilityText = marked.length > 0
        ? `keep the facility answer (${[...new Set(marked)].join('; ')})`
        : 'leave the facility unknown until a moderator marks it'
    const saidNotAccepted = codes.includes(OldInsuranceCode.InsuranceNotAccepted)
        && row.facilities.some(facility => facility.japaneseInsurance === 'ACCEPTED')
    const checkText = saidNotAccepted
        ? ' Check the clinic: an old code said it does not accept insurance.'
            + ' If it is self-pay only, mark it so.'
        : ''

    return {
        action: 'clear',
        shape,
        sentences: codes.map(insuranceSentence),
        recommendation: `${codesText} and ${facilityText}.${checkText}`
    }
}

export type StoredInsuranceReport = {
    total: number
    withCodes: number
    shapes: Record<InsuranceShape, number>
}

export function reportStoredInsurance(rows: readonly StoredInsuranceRow[]): StoredInsuranceReport {
    const shapes: Record<InsuranceShape, number> = { dual_default: 0, japanese_only: 0, uninsured_only: 0, other: 0 }
    let withCodes = 0

    for (const row of rows) {
        const codes = storedCodes(row.acceptedInsurance)
        if (codes.length === 0) {
            continue
        }
        withCodes += 1
        shapes[insuranceShape(codes)] += 1
    }

    return { total: rows.length, withCodes, shapes }
}

/** One readable line per professional: facility, city, and the old values as sentences. */
export function describeStoredInsurance(
    professionalId: string,
    professionalName: string,
    row: StoredInsuranceRow,
    plan: Extract<StoredInsurancePlan, { action: 'clear' }>
): string {
    const facilities = row.facilities.length > 0
        ? row.facilities.map(facility => facility.city ? `${facility.name} (${facility.city})` : facility.name).join(', ')
        : 'no linked facility'

    return [
        `${professionalName} [${professionalId}] at ${facilities}`,
        `  stored: ${plan.sentences.join('; ')}`,
        `  recommendation: ${plan.recommendation}`
    ].join('\n')
}
