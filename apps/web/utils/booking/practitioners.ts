import type { BookingPractitioner, LocalizedName } from '@findadoc/graphql'
import { toGqlLocale } from '~/utils/activeLocale'
import { formatHealthcareProfessionalName } from '~/utils/nameUtils'

/** A doctor's name for the reader's language, or '' when the row has no name. */
export function practitionerName(names: readonly LocalizedName[] | undefined, i18nLocale: string): string {
    if (names === undefined || names.length === 0) {
        return ''
    }
    return formatHealthcareProfessionalName([...names], toGqlLocale(i18nLocale))
}

/** Doctors sorted by name in the reader's language. */
export function sortedPractitioners(
    practitioners: readonly BookingPractitioner[],
    i18nLocale: string
): BookingPractitioner[] {
    return [...practitioners].sort((a, b) =>
        practitionerName(a.names, i18nLocale).localeCompare(practitionerName(b.names, i18nLocale), i18nLocale))
}

/**
 * True when the clinic's interpretation covers every chosen language, so any doctor
 * can see the patient in them (#205). Matches interpretationCovers in the API:
 * a language the clinic does not list still narrows the doctors.
 */
export function interpretationCovers(
    offersInterpretation: boolean,
    clinicLanguages: readonly string[],
    chosenLanguages: readonly string[]
): boolean {
    return offersInterpretation && chosenLanguages.every(language => clinicLanguages.includes(language))
}

/** Doctors the patient may pick for the chosen languages: those who speak them all, or everyone when interpreted. */
export function practitionersForLanguages(
    practitioners: readonly BookingPractitioner[],
    chosenLanguages: readonly string[],
    interpreted: boolean
): BookingPractitioner[] {
    return interpreted
        ? [...practitioners]
        : practitioners.filter(practitioner =>
            chosenLanguages.every(language => practitioner.spokenLanguages.some(spoken => spoken === language)))
}
