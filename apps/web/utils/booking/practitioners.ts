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
