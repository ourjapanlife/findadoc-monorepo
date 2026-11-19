import { OpeningDay, type Facility, type OpeningHours, type OpeningHoursInput } from '@findadoc/graphql'
import { normalizeOpeningHours, OPENING_DAYS, openingHoursProblem, openingMinutes } from '@findadoc/utils'

/**
 * Published opening hours on a facility (#294). Structured, so every locale reads them with no
 * translation work: day names come from the locale files and times are a 24-hour clock in Japan time.
 * An empty list is unknown and readers see nothing. Once hours are known, a day with no block is closed.
 */

type Translate = (key: string) => string

// Literal t() calls, so i18n/cleanUnusedLocaleKeys.js sees each key as used.
/** The reader-facing name of a day, or of public holidays. */
export function openingDayLabel(day: OpeningDay, t: Translate): string {
    const labels: Record<OpeningDay, string> = {
        [OpeningDay.Monday]: t('openingHours.days.monday'),
        [OpeningDay.Tuesday]: t('openingHours.days.tuesday'),
        [OpeningDay.Wednesday]: t('openingHours.days.wednesday'),
        [OpeningDay.Thursday]: t('openingHours.days.thursday'),
        [OpeningDay.Friday]: t('openingHours.days.friday'),
        [OpeningDay.Saturday]: t('openingHours.days.saturday'),
        [OpeningDay.Sunday]: t('openingHours.days.sunday'),
        [OpeningDay.PublicHoliday]: t('openingHours.days.publicHoliday')
    }
    return labels[day]
}

export type OpeningHoursRow = {
    day: OpeningDay
    label: string
    /** "09:00–12:30, 15:00–18:00", or the closed label. */
    times: string
    closed: boolean
}

/** One row per day for the clinic page, or [] when the hours are unknown. */
export function openingHoursRows(blocks: readonly OpeningHours[] | null | undefined, t: Translate): OpeningHoursRow[] {
    const known = normalizeOpeningHours(blocks ?? [])

    if (!known.length) {
        return []
    }

    return OPENING_DAYS.map(day => {
        const times = known.filter(block => block.day === day).map(block => `${block.opens}–${block.closes}`)

        return {
            day,
            label: openingDayLabel(day, t),
            times: times.length ? times.join(', ') : t('openingHours.closed'),
            closed: !times.length
        }
    })
}

/**
 * The form's blocks as API input, in day order. Every block is kept, valid or not: dropping an
 * invalid one would quietly turn that day into closed. `visitorInfoProblems` stops the save first.
 */
export function openingHoursInput(blocks: readonly OpeningHours[]): OpeningHoursInput[] {
    return blocks
        .map(block => ({ day: block.day, opens: block.opens, closes: block.closes }))
        .sort((a, b) => OPENING_DAYS.indexOf(a.day) - OPENING_DAYS.indexOf(b.day)
          || (openingMinutes(a.opens) ?? 0) - (openingMinutes(b.opens) ?? 0))
}

/** The new list when the moderator changed it, or undefined when it is the same as the saved one. */
export function changedOpeningHours(
    current: readonly OpeningHours[],
    original: readonly OpeningHours[] | null | undefined
): OpeningHoursInput[] | undefined {
    const next = openingHoursInput(current)

    return JSON.stringify(next) === JSON.stringify(normalizeOpeningHours(original ?? [])) ? undefined : next
}

/**
 * Why the hours or the note on the form cannot be saved, as i18n keys. Checked on the raw draft, so
 * an invalid block blocks the save instead of being dropped. Empty when the draft can be saved.
 */
export function visitorInfoProblems(draft: {
    openingHours?: readonly OpeningHoursInput[] | null
    additionalInfoEn?: string | null
    additionalInfoJa?: string | null
}): string[] {
    const problems: string[] = []

    if (openingHoursProblem(draft.openingHours ?? []) !== null) {
        problems.push('serverErrorMessages.invalidOpeningHours')
    }
    if (Boolean(draft.additionalInfoEn?.trim()) !== Boolean(draft.additionalInfoJa?.trim())) {
        problems.push('serverErrorMessages.additionalInfoBothLanguages')
    }

    return problems
}

export type VisitorNote = { text: string, lang: 'en' | 'ja' }

/**
 * The visitor note in the reader's language (#294). Moderators write English and Japanese.
 * Japanese readers get the Japanese note; every other locale gets the English one.
 */
export function visitorNote(
    facility: Pick<Facility, 'additionalInfoEn' | 'additionalInfoJa'>,
    isJapanese: boolean
): VisitorNote | null {
    const en = facility.additionalInfoEn?.trim() ?? ''
    const ja = facility.additionalInfoJa?.trim() ?? ''

    if (isJapanese && ja) {
        return { text: ja, lang: 'ja' }
    }
    if (en) {
        return { text: en, lang: 'en' }
    }

    return ja ? { text: ja, lang: 'ja' } : null
}
