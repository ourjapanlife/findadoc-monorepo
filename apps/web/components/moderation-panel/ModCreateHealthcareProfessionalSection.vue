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
                <div class="mod-picker">
                    <label
                        for="specialties"
                        class="field-label"
                    >
                        {{ t("modHealthcareProfessionalSection.selectSpecialties") }}
                    </label>
                    <ModSearchBar
                        v-if="createHealthcareProfessionalSectionFields.specialties"
                        v-model="createHealthcareProfessionalSectionFields.specialties"
                        data-testid="mod-healthcare-professional-section-specialties"
                        :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextSpecialties')"
                        :no-match-text="t('modHealthcareProfessionalSection.noSpecialtiesWereFound')"
                        :fields-to-display-callback="specialtiesToDisplayCallback"
                        :default-suggestions="Object.values(Specialty)"
                        @search-input-change="handleSpecialtyInputChange"
                    />
                    <ModTokenList :labels="tokenLabels(createHealthcareProfessionalSectionFields.specialties)" />
                </div>
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
import { Locale, Specialty } from '@findadoc/graphql'
import { useI18n } from '#imports'
import { filterByCaseInsensitiveIncludes } from '~/utils/moderationSearchUtils'

const { t } = useI18n()

const loadingStore = useLoadingStore()
loadingStore.setIsLoading(true)

const localesStore = useLocaleStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const facilitiesStore = useFacilitiesStore()
await facilitiesStore.getFacilities() // Fix a bug where facilities disappear after the user refreshes the page

const createHealthcareProfessionalSectionFields = healthcareProfessionalsStore.createHealthcareProfessionalSectionFields
const tokenLabels = (values: readonly unknown[] | null | undefined) =>
    (values ?? []).map(item => String(item))
const spokenLanguageLabels = computed(() =>
    (createHealthcareProfessionalSectionFields.spokenLanguages ?? [])
        .map(locale => localesStore.formatLanguageCodeToSimpleText(locale)))
const facilityRemoveLabel = (name: string) =>
    t('modHealthcareProfessionalSection.removeFacility', { name })

const handleSpecialtyInputChange = (filteredItems: Ref<Specialty[]>, inputValue: string) => {
    const arrayOfSpecialties = Object.values(Specialty) as Specialty[]
    filteredItems.value = filterByCaseInsensitiveIncludes(arrayOfSpecialties, inputValue)
}

const handleLocaleInputChange = (filteredItems: Ref<Locale[]>, inputValue: string) => {
    const arrayOfLocales = Object.values(Locale) as Locale[]

    if (!inputValue) {
        filteredItems.value = arrayOfLocales
        return
    }

    filteredItems.value = localesStore.getLocaleByNameInput(inputValue)
}

const specialtiesToDisplayCallback = (specialty: Specialty) => [specialty]
const localesToDisplayCallback = (locale: Locale) => [localesStore.formatLanguageCodeToSimpleText(locale)]
</script>
