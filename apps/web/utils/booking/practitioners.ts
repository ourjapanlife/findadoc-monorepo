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

/** What one interpreter covers, as the Book page sees it (#205). */
export type InterpreterLanguages = { languages: readonly string[] }

/**
 * True when one interpreter covers every chosen language this doctor does not speak.
 * Matches scheduleLanes in the API (docs/booking-interpretation.md). Times still
 * come from the starts query, which checks the interpreter's hours and capacity.
 */
export function interpreterCoversDoctor(
    spokenLanguages: readonly string[],
    chosenLanguages: readonly string[],
    interpreters: readonly InterpreterLanguages[]
): boolean {
    const gap = chosenLanguages.filter(language => !spokenLanguages.includes(language))
    return gap.length > 0
      && interpreters.some(interpreter => gap.every(language => interpreter.languages.includes(language)))
}

/** Doctors the patient may pick: those who speak every chosen language, or whom an interpreter covers. */
export function practitionersForLanguages(
    practitioners: readonly BookingPractitioner[],
    chosenLanguages: readonly string[],
    interpreters: readonly InterpreterLanguages[]
): BookingPractitioner[] {
    return practitioners.filter(practitioner =>
        chosenLanguages.every(language => practitioner.spokenLanguages.some(spoken => spoken === language))
        || interpreterCoversDoctor(practitioner.spokenLanguages, chosenLanguages, interpreters))
}
