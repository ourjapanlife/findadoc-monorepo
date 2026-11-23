<template>
    <div class="mod-picker">
        <div class="mod-edit-only flex flex-col gap-1">
            <label
                :for="groupSelectId"
                class="field-label"
            >
                {{ t('modHealthcareProfessionalSection.specialtyGroupLabel') }}
            </label>
            <select
                :id="groupSelectId"
                v-model="group"
                :data-testid="`${testId}-group`"
                class="field"
                :disabled="!isEditing"
            >
                <option value="">
                    {{ t('modHealthcareProfessionalSection.allSpecialtyGroups') }}
                </option>
                <option
                    v-for="option in groups"
                    :key="option.code"
                    :value="option.code"
                >
                    {{ option.displayText }}
                </option>
            </select>
        </div>
        <label
            for="specialties"
            class="field-label"
        >
            {{ t('modHealthcareProfessionalSection.selectSpecialties') }}
        </label>
        <ModSearchBar
            v-model="selected"
            :data-test-id="testId"
            :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextSpecialties')"
            :no-match-text="t('modHealthcareProfessionalSection.noSpecialtiesWereFound')"
            :fields-to-display-callback="displayFields"
            :default-suggestions="suggestions"
            @search-input-change="filterSuggestions"
        />
        <p class="mod-edit-only m-0 text-xs text-primary-text-muted">
            {{ t('modHealthcareProfessionalSection.specialtySearchHint') }}
        </p>
        <ModTokenList :labels="selectedLabels" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Specialty, SpecialtyCategory } from '@findadoc/graphql'
import { SPECIALTY_DISPLAY_ORDER, HIDDEN_SPECIALTIES } from '@findadoc/utils'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'
import { CATEGORY_LABEL_KEYS, SPECIALTY_LABEL_KEYS } from '~/utils/specialtyLabelKeys'
import {
    bilingualSpecialtyLabel,
    groupOptions,
    specialtiesForGroup,
    specialtyMatchesQuery
} from '~/utils/specialtyPicker'

/*
 * Group first, then the specialty, so a moderator scans a handful of options, not 58 (#277). Typing
 * searches English, Japanese, and the department names clinics list (胃腸内科 finds gastroenterology),
 * across every group when none is picked. Selected specialties show their labels, not enum codes.
 */
defineProps<{ testId: string }>()
const selected = defineModel<Specialty[]>({ required: true })

const { t } = useI18n()
const isEditing = useModerationFormEditing()
const groupSelectId = useId()
const group = ref<SpecialtyCategory | ''>('')

const labelOf = (code: Specialty) => t(SPECIALTY_LABEL_KEYS[code])

const groups = computed(() => groupOptions(code => t(CATEGORY_LABEL_KEYS[code]), undefined, group.value || undefined))

const visible = SPECIALTY_DISPLAY_ORDER
    .filter(code => !HIDDEN_SPECIALTIES.has(code))
    .map(code => ({ code }))

const suggestions = computed(() => (group.value
    ? specialtiesForGroup(visible, group.value)
    : visible).map(option => option.code))

function filterSuggestions(filteredItems: Ref<Specialty[]>, inputValue: string) {
    filteredItems.value = suggestions.value.filter(code => specialtyMatchesQuery(code, labelOf(code), inputValue))
}

const displayFields = (code: Specialty) => [bilingualSpecialtyLabel(code, labelOf(code))]

const selectedLabels = computed(() => (selected.value ?? []).map(code => labelOf(code)))
</script>
