import { JapaneseInsurance } from '@findadoc/graphql'

/**
 * Japanese public health insurance lives on the facility (#18).
 * Readers only see a line when a clinic does not take it. An empty choice is unknown.
 */
export type JapaneseInsuranceChoice = '' | JapaneseInsurance

export const JAPANESE_INSURANCE_CHOICES: readonly JapaneseInsuranceChoice[] = [
    '',
    JapaneseInsurance.Accepted,
    JapaneseInsurance.NotAccepted
]

/** Marketing page that explains public insurance, self-pay, and overseas claims. */
export const INSURANCE_GUIDE_PATH = '/insurance'

export function japaneseInsuranceChoice(value: JapaneseInsurance | null | undefined): JapaneseInsuranceChoice {
    return value === JapaneseInsurance.Accepted || value === JapaneseInsurance.NotAccepted ? value : ''
}

export const JAPANESE_INSURANCE_SOURCE_MAX = 500

/** The source is an optional note: a link, or a call to the clinic. */
export function isValidJapaneseInsuranceSource(source: string | undefined): boolean {
    return (source ?? '').trim().length <= JAPANESE_INSURANCE_SOURCE_MAX
}

/**
 * Fields for a create or update input. Unknown is null. The source note is kept only on a
 * self-pay-only answer, the same rule the API applies, so the update diff matches what is stored.
 */
export function japaneseInsuranceInput(choice: JapaneseInsuranceChoice, source: string | undefined) {
    if (choice === '') {
        return { japaneseInsurance: null, japaneseInsuranceSource: null }
    }

    const note = choice === JapaneseInsurance.NotAccepted ? (source ?? '').trim() || null : null
    return { japaneseInsurance: choice, japaneseInsuranceSource: note }
}
