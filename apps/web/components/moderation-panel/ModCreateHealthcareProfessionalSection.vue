<template>
    <div class="mod-sheet">
        <ModFormKind
            kind="healthcare"
            :label="t('modDashboardLeftNav.healthcareProfessionals')"
        />
        <ModAccordion
            tone="healthcare"
            class="mod-healthcare-professional-section"
            :title="t('modHealthcareProfessionalSection.healthcareProfessionalNameHeading')"
        >
            <ModProfessionalNamesEditor v-model="createHealthcareProfessionalSectionFields.names" />
        </ModAccordion>
        <ModAccordion
            tone="healthcare"
            :title="t('modHealthcareProfessionalSection.healthcareProfessionalMedicalInfoHeading')"
        >
            <div class="mod-form-grid">
                <ModProfessionalLicenseFields
                    v-if="createHealthcareProfessionalSectionFields.degrees"
                    v-model:degrees="createHealthcareProfessionalSectionFields.degrees"
                />
                <ModSpecialtyPicker
                    v-if="createHealthcareProfessionalSectionFields.specialties"
                    v-model="createHealthcareProfessionalSectionFields.specialties"
                    test-id="mod-healthcare-professional-section-specialties"
                />
                <div class="mod-picker">
                    <label
                        for="locales"
                        class="field-label"
                    >
                        {{ t("modHealthcareProfessionalSection.selectLocales") }}
                    </label>
                    <ModSearchBar
                        v-if="createHealthcareProfessionalSectionFields.spokenLanguages"
                        v-model="createHealthcareProfessionalSectionFields.spokenLanguages"
                        input-id="locales"
                        data-testid="mod-healthcare-professional-section-spoken-locales"
                        :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextLocales')"
                        :no-match-text="t('modHealthcareProfessionalSection.noLocalesWereFound')"
                        :fields-to-display-callback="localesToDisplayCallback"
                        :default-suggestions="Object.values(Locale)"
                        @search-input-change="handleLocaleInputChange"
                    />
                    <ModTokenList :labels="spokenLanguageLabels" />
                </div>
                <NoteInputField
                    v-model="createHealthcareProfessionalSectionFields.additionalInfoForPatients!"
                    class="mod-span-2"
                    :label="t('modHealthcareProfessionalSection.labelAdditionalNotesForPatients')"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderAdditionalNotesForPatients')"
                    :required="false"
                />
            </div>
        </ModAccordion>
        <ModAccordion
            tone="healthcare"
            :title="t('modHealthcareProfessionalSection.facilities')"
        >
            <ModLinkedFacilities
                v-model="createHealthcareProfessionalSectionFields.facilityIds"
                data-test-id="mod-healthcare-professional-section-facilities"
                :suggestions="facilitiesStore.facilityData"
                :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextFacilitySearchBar')"
                :no-match-text="t('modHealthcareProfessionalSection.noFacilitiesWereFound')"
                :empty-text="t('modHealthcareProfessionalSection.noFacilitiesLinked')"
                :remove-label="facilityRemoveLabel"
            />
        </ModAccordion>
    </div>
</template>

<script lang="ts" setup>
import { computed, type Ref } from 'vue'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useLocaleStore } from '~/stores/localeStore'
import { Locale } from '@findadoc/graphql'
import { useI18n } from '#imports'

const { t } = useI18n()

const loadingStore = useLoadingStore()
loadingStore.setIsLoading(true)

const localesStore = useLocaleStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const facilitiesStore = useFacilitiesStore()
await facilitiesStore.getFacilities() // Fix a bug where facilities disappear after the user refreshes the page

const createHealthcareProfessionalSectionFields = healthcareProfessionalsStore.createHealthcareProfessionalSectionFields
const spokenLanguageLabels = computed(() =>
    (createHealthcareProfessionalSectionFields.spokenLanguages ?? [])
        .map(locale => localesStore.formatLanguageCodeToSimpleText(locale)))
const facilityRemoveLabel = (name: string) =>
    t('modHealthcareProfessionalSection.removeFacility', { name })

const handleLocaleInputChange = (filteredItems: Ref<Locale[]>, inputValue: string) => {
    const arrayOfLocales = Object.values(Locale) as Locale[]

    if (!inputValue) {
        filteredItems.value = arrayOfLocales
        return
    }

    filteredItems.value = localesStore.getLocaleByNameInput(inputValue)
}

const localesToDisplayCallback = (locale: Locale) => [localesStore.formatLanguageCodeToSimpleText(locale)]
</script>
