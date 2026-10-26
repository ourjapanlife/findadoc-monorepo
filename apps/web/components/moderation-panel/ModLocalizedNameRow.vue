<template>
    <div class="mod-localized-name-row grid items-end gap-3 landscape:grid-cols-[1fr_1fr_1fr_minmax(10rem,1fr)_auto]">
        <ModInputField
            v-model="name.lastName"
            data-testid="mod-healthcare-professional-section-lastName"
            :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalLastName')"
            type="text"
            :placeholder="t('modHealthcareProfessionalSection.placeholderTextHealthcareProfessionalLastName')"
            :required="true"
        />
        <ModInputField
            v-model="name.firstName"
            data-testid="mod-healthcare-professional-section-firstName"
            :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalFirstName')"
            type="text"
            :placeholder="t('modHealthcareProfessionalSection.placeholderTextHealthcareProfessionalFirstName')"
            :required="true"
        />
        <ModInputField
            v-model="name.middleName as string"
            data-testid="mod-healthcare-professional-section-middleName"
            :label="t('modHealthcareProfessionalSection.labelHealthcareProfessionalMiddleName')"
            type="text"
            :placeholder="t('modHealthcareProfessionalSection.placeholderTextHealthcareProfessionalMiddleName')"
            :required="false"
        />
        <div class="flex flex-col">
            <label
                :for="selectId"
                class="field-label"
            >
                {{ t('modHealthcareProfessionalSection.labelHealthcareProfessionalNameLocale') }}
            </label>
            <select
                :id="selectId"
                v-model="name.locale"
                data-testid="mod-healthcare-professional-section-name-locale"
                name="name-locales"
                class="field"
            >
                <option
                    v-for="(locale, index) in Locale"
                    :key="`${locale}-${index}`"
                    :value="locale"
                >
                    {{ localesStore.formatLanguageCodeToSimpleText(locale) }}
                </option>
            </select>
        </div>
        <button
            v-if="removable"
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center self-end rounded-full
                text-lg leading-none text-primary-text hover:bg-accent-bg"
            :aria-label="t('modHealthcareProfessionalSection.removeName')"
            data-testid="mod-healthcare-professional-section-remove-name-row"
            @click="emit('remove')"
        >
            ×
        </button>
        <span
            v-else
            class="hidden w-10 landscape:block"
            aria-hidden="true"
        />
    </div>
</template>

<script lang="ts" setup>
import { useId } from 'vue'
import { Locale, type LocalizedNameInput } from '@findadoc/graphql'
import { useI18n } from '#imports'
import { useLocaleStore } from '~/stores/localeStore'

defineProps<{ removable?: boolean }>()
const emit = defineEmits<{ remove: [] }>()
const name = defineModel<LocalizedNameInput>({ required: true })

const { t } = useI18n()
const localesStore = useLocaleStore()
const selectId = useId()
</script>
