import type { BookingLocalizedText } from '@findadoc/graphql'

/** A clinic-written question always has English. Another locale without a label shows it (#166). */
export const CLINIC_LABEL_FALLBACK_LOCALE = 'en-US'

/** True when the clinic wrote this label (a Find a Doc field has none and uses its i18n key). */
export function isClinicWritten(labels: readonly BookingLocalizedText[] | null | undefined): boolean {
    return (labels?.length ?? 0) > 0
}

export function hasClinicLabel(labels: readonly BookingLocalizedText[], locale: string): boolean {
    return labels.some(label => label.locale === locale)
}

/** The clinic's label in this locale, else its English label. */
export function clinicLabel(labels: readonly BookingLocalizedText[], locale: string): string {
    return labels.find(label => label.locale === locale)?.text
      ?? labels.find(label => label.locale === CLINIC_LABEL_FALLBACK_LOCALE)?.text
      ?? labels[0]?.text
      ?? ''
}
