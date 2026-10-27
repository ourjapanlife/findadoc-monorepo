import { Locale, type LocalizedNameInput } from '@findadoc/graphql'
import { validateNameLocaleMatchesLanguage } from '~/utils/formValidations'

export type LocalizedNameDraftError
    = | 'missingLastName'
      | 'missingFirstName'
      | 'missingLocale'
      | 'nameForLocaleAlreadyExists'
      | 'charactersOfLanguageDoNotMatchNameLocale'

export type LocalizedNameDraftResult
    = | { names: LocalizedNameInput[], error?: undefined }
      | { error: LocalizedNameDraftError, names?: undefined }

export const emptyNameDraft = (): LocalizedNameInput => ({
    firstName: '',
    lastName: '',
    middleName: '',
    locale: Locale.Und
})

const isBlankDraft = (draft: LocalizedNameInput) =>
    !draft.firstName.trim()
    && !draft.lastName.trim()
    && !(draft.middleName ?? '').trim()
    && (draft.locale === Locale.Und || !draft.locale)

/**
 * Blank rows are dropped. Every other row must be a complete name in a language that
 * neither the existing names nor another row already uses.
 */
export function validateLocalizedNameDrafts(
    drafts: readonly LocalizedNameInput[],
    existingNames: readonly LocalizedNameInput[],
    options: { checkCharacters: boolean }
): LocalizedNameDraftResult {
    const filled = drafts.filter(draft => !isBlankDraft(draft))

    if (!filled.length) {
        return { error: 'missingLastName' }
    }

    const usedLocales = new Set(existingNames.map(name => name.locale))
    const names: LocalizedNameInput[] = []

    for (const draft of filled) {
        const name: LocalizedNameInput = {
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            middleName: (draft.middleName ?? '').trim(),
            locale: draft.locale || Locale.Und
        }

        if (!name.lastName) return { error: 'missingLastName' }
        if (!name.firstName) return { error: 'missingFirstName' }
        if (name.locale === Locale.Und) return { error: 'missingLocale' }
        if (usedLocales.has(name.locale)) return { error: 'nameForLocaleAlreadyExists' }
        if (options.checkCharacters && !validateNameLocaleMatchesLanguage(name)) {
            return { error: 'charactersOfLanguageDoNotMatchNameLocale' }
        }

        usedLocales.add(name.locale)
        names.push(name)
    }

    return { names }
}
