<template>
    <div
        class="flex flex-col gap-4"
        data-testid="mod-professional-names-editor"
    >
        <p
            v-if="needsReview"
            class="rounded-lg border border-warning bg-warning/10 p-3 text-sm text-primary-text"
            role="status"
            data-testid="mod-professional-names-needs-review"
        >
            {{ t('modHealthcareProfessionalSection.nameNeedsReview') }}
        </p>
        <p
            v-if="hasOtherLocales"
            class="text-sm text-primary-text-muted"
            data-testid="mod-professional-names-other-locales"
        >
            {{ t('modHealthcareProfessionalSection.otherLocaleNamesRemoved') }}
        </p>
        <fieldset class="flex flex-col gap-3">
            <legend class="field-label mb-2">
                {{ t('modHealthcareProfessionalSection.romajiName') }}
            </legend>
            <div class="grid items-end gap-3 landscape:grid-cols-3">
                <ModInputField
                    v-model="romajiLastName"
                    data-testid="mod-professional-name-romaji-lastName"
                    :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalLastName')"
                    type="text"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderTextHealthcareProfessionalLastName')"
                    :required="true"
                />
                <ModInputField
                    v-model="romajiFirstName"
                    data-testid="mod-professional-name-romaji-firstName"
                    :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalFirstName')"
                    type="text"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderTextHealthcareProfessionalFirstName')"
                    :required="true"
                />
                <ModInputField
                    v-model="romajiMiddleName"
                    data-testid="mod-professional-name-romaji-middleName"
                    :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalMiddleName')"
                    type="text"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderTextHealthcareProfessionalMiddleName')"
                    :required="false"
                />
            </div>
        </fieldset>
        <fieldset class="flex flex-col gap-3">
            <legend class="field-label mb-2">
                {{ t('modHealthcareProfessionalSection.japaneseName') }}
            </legend>
            <p class="text-sm text-primary-text-muted">
                {{ t('modHealthcareProfessionalSection.japaneseNameHint') }}
            </p>
            <div class="grid items-end gap-3 landscape:grid-cols-3">
                <ModInputField
                    v-model="japaneseLastName"
                    data-testid="mod-professional-name-japanese-lastName"
                    :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalLastName')"
                    type="text"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderTextJapaneseLastName')"
                    :required="true"
                />
                <ModInputField
                    v-model="japaneseFirstName"
                    data-testid="mod-professional-name-japanese-firstName"
                    :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalFirstName')"
                    type="text"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderTextJapaneseFirstName')"
                    :required="true"
                />
            </div>
        </fieldset>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { Locale, type LocalizedNameInput } from '@findadoc/graphql'
import { useI18n } from '#imports'
import {
    hasOtherLocaleNames,
    professionalNameFor,
    withProfessionalNameField,
    type ProfessionalNameField,
    type ProfessionalNameLocale
} from '~/utils/professionalNames'

/** Two fixed rows: the romaji name and the Japanese name (#282). No other locale is offered. */
defineProps<{ needsReview?: boolean }>()
const names = defineModel<LocalizedNameInput[]>({ required: true })

const { t } = useI18n()

const hasOtherLocales = computed(() => hasOtherLocaleNames(names.value))

const nameField = (locale: ProfessionalNameLocale, field: ProfessionalNameField) => computed({
    get: () => professionalNameFor(names.value, locale)?.[field] ?? '',
    set: (value: string) => {
        names.value = withProfessionalNameField(names.value, locale, field, value)
    }
})

const romajiLastName = nameField(Locale.EnUs, 'lastName')
const romajiFirstName = nameField(Locale.EnUs, 'firstName')
const romajiMiddleName = nameField(Locale.EnUs, 'middleName')
const japaneseLastName = nameField(Locale.JaJp, 'lastName')
const japaneseFirstName = nameField(Locale.JaJp, 'firstName')
</script>
