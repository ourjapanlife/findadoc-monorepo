<template>
    <div
        class="flex flex-col gap-4"
        data-testid="booking-doctor-picker"
    >
        <fieldset
            v-if="languages.length > 1"
            class="flex min-w-0 flex-col gap-2"
        >
            <legend class="field-label">
                {{ t('bookingPage.languageLabel') }}
            </legend>
            <p class="-mt-1 text-sm text-primary-text-muted">
                {{ t('bookingPage.languageHelp') }}
            </p>
            <div class="flex flex-wrap gap-2">
                <button
                    v-for="language in sortedLanguages"
                    :key="language"
                    type="button"
                    class="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-3 py-1
                    text-left text-xs/tight font-semibold wrap-anywhere transition-colors sm:px-4 sm:text-sm/tight"
                    :class="spokenLanguages.includes(language)
                        ? 'border-primary bg-primary text-primary-text-inverted hover:bg-primary-hover'
                        : 'border-border-strong bg-secondary-bg text-primary-text hover:border-primary'"
                    :aria-pressed="spokenLanguages.includes(language)"
                    :data-testid="`booking-language-${language}`"
                    @click="toggleLanguage(language)"
                >
                    <svg
                        v-if="spokenLanguages.includes(language)"
                        class="size-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {{ languageName(language, locale) }}
                </button>
            </div>
        </fieldset>

        <fieldset
            v-if="practitioners.length > 0"
            class="flex min-w-0 flex-col gap-2"
        >
            <legend class="field-label">
                {{ t('bookingPage.doctorLabel') }}
            </legend>
            <div
                class="flex flex-col gap-2"
                role="radiogroup"
            >
                <button
                    type="button"
                    role="radio"
                    :class="optionClass(practitionerId === null)"
                    :aria-checked="practitionerId === null"
                    data-testid="booking-doctor-any"
                    @click="emit('update:practitionerId', null)"
                >
                    <span class="font-semibold text-primary-text">{{ t('bookingPage.anyDoctor') }}</span>
                    <span class="text-sm text-primary-text-muted">
                        {{ spokenLanguages.length > 0
                            ? t('bookingPage.anyDoctorLanguageHelp', { languages: chosenLanguageNames })
                            : t('bookingPage.anyDoctorHelp') }}
                    </span>
                </button>
                <button
                    v-for="practitioner in matchingPractitioners"
                    :key="practitioner.id"
                    type="button"
                    role="radio"
                    :class="optionClass(practitionerId === practitioner.id)"
                    :aria-checked="practitionerId === practitioner.id"
                    :data-testid="`booking-doctor-${practitioner.id}`"
                    @click="emit('update:practitionerId', practitioner.id)"
                >
                    <span class="font-semibold text-primary-text">{{ practitionerName(practitioner.names, locale) }}</span>
                    <span
                        v-if="specialtyLabels(practitioner).length > 0"
                        class="text-sm text-primary-text-muted"
                    >
                        {{ specialtyLabels(practitioner).join(', ') }}
                    </span>
                    <span
                        v-if="practitioner.spokenLanguages.length > 0"
                        class="flex flex-wrap gap-1"
                        :aria-label="t('bookingPage.doctorLanguages')"
                    >
                        <span
                            v-for="language in practitioner.spokenLanguages"
                            :key="language"
                            class="chip h-auto min-h-6 max-w-full whitespace-normal wrap-anywhere px-2 py-0.5 text-xs"
                            :class="spokenLanguages.includes(language) ? 'border-primary text-primary' : ''"
                        >
                            {{ languageName(language, locale) }}
                        </span>
                    </span>
                </button>
            </div>
            <p
                v-if="hiddenCount > 0"
                class="text-sm text-primary-text-muted"
                data-testid="booking-doctor-hidden"
            >
                {{ t('bookingPage.doctorsHidden', { n: hiddenCount }) }}
            </p>
        </fieldset>
    </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookingPractitioner, Locale } from '@findadoc/graphql'
import { useSpecialtiesStore } from '~/stores/specialtiesStore'
import { practitionerName, sortedPractitioners } from '~/utils/booking/practitioners'
import { languageName } from '~/utils/languageName'

/**
 * The patient picks the languages they need and, optionally, a doctor. Only
 * doctors who speak every chosen language are listed. "Any doctor" books the
 * first free doctor who speaks them, or clinic time.
 */
const props = defineProps<{
    practitioners: readonly BookingPractitioner[]
    languages: readonly Locale[]
    practitionerId: string | null
    spokenLanguages: readonly Locale[]
}>()

const emit = defineEmits<{
    'update:practitionerId': [value: string | null]
    'update:spokenLanguages': [value: Locale[]]
}>()

const { t, locale } = useI18n()
const specialtiesStore = useSpecialtiesStore()

const sortedLanguages = computed(() => [...props.languages]
    .sort((a, b) => languageName(a, locale.value).localeCompare(languageName(b, locale.value), locale.value)))

const chosenLanguageNames = computed(() => new Intl.ListFormat(locale.value || 'en', { type: 'conjunction' })
    .format(props.spokenLanguages.map(language => languageName(language, locale.value))))

const matchingPractitioners = computed(() => sortedPractitioners(props.practitioners, locale.value)
    .filter(practitioner => props.spokenLanguages.every(language => practitioner.spokenLanguages.includes(language))))

const hiddenCount = computed(() => props.practitioners.length - matchingPractitioners.value.length)

function specialtyLabels(practitioner: BookingPractitioner): string[] {
    return practitioner.specialties
        .map(code => specialtiesStore.specialtyDisplayOptions.find(option => option.code === code)?.displayText)
        .filter((label): label is string => typeof label === 'string' && label !== '')
}

function optionClass(selected: boolean): string {
    const base = 'flex w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors'
    return selected
        ? `${base} border-primary bg-primary/5 ring-1 ring-inset ring-primary`
        : `${base} border-accent-bg bg-secondary-bg hover:border-primary`
}

function toggleLanguage(language: Locale): void {
    emit('update:spokenLanguages', props.spokenLanguages.includes(language)
        ? props.spokenLanguages.filter(item => item !== language)
        : [...props.spokenLanguages, language])
}

// A chosen doctor who does not speak a newly chosen language goes back to "any doctor".
watch(matchingPractitioners, matching => {
    if (props.practitionerId !== null && !matching.some(practitioner => practitioner.id === props.practitionerId)) {
        emit('update:practitionerId', null)
    }
})
</script>
