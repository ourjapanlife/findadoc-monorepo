import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Specialty } from '@findadoc/graphql'
import { SPECIALTY_CATEGORY_DISPLAY_ORDER, SPECIALTY_CATEGORY_MEMBERS, SPECIALTY_DISPLAY_ORDER } from '@findadoc/utils'
import { CATEGORY_LABEL_KEYS, SPECIALTY_LABEL_KEYS } from '~/utils/specialtyLabelKeys'

export const useSpecialtiesStore = defineStore('specialtiesStore', () => {
    const { t } = useI18n()

    const specialtyCategories = computed(() => SPECIALTY_CATEGORY_DISPLAY_ORDER
        .map(code => ({ code, displayText: t(CATEGORY_LABEL_KEYS[code]) })))

    const specialtyDisplayOptions = computed((): SpecialtyDisplayOption[] => SPECIALTY_DISPLAY_ORDER
        .map(code => ({ code, displayText: t(SPECIALTY_LABEL_KEYS[code]) })))

    // The specialties under each category, shared with the API and MCP. The homepage tiles read it.
    const categoryToSpecialtyMap = computed(() => SPECIALTY_CATEGORY_MEMBERS)

    return {
        specialtyCategories,
        specialtyDisplayOptions,
        categoryToSpecialtyMap
    }
})

export interface SpecialtyDisplayOption {
    code: Specialty
    displayText: string
}
