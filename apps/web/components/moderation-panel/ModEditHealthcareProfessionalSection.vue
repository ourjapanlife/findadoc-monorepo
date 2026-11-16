<template>
    <Loader v-if="moderationScreenStore.editHealthcareProfessionalScreenIsActive()" />
    <div
        v-if="isHealthcareProfessionalInitialized"
        class="mod-sheet"
        :data-mod-mode="isEditing ? 'edit' : 'preview'"
    >
        <div class="flex items-center justify-between gap-3">
            <ModFormKind
                kind="healthcare"
                :label="t('modDashboardLeftNav.healthcareProfessionals')"
            />
            <ModFormModeToggle v-if="ownsFormMode" />
        </div>
        <ModAccordion
            :id="ModHealthcareProfessionalsLeftNavbarSections.HealthcareProfessionalName"
            tone="healthcare"
            class="mod-healthcare-professional-section"
            :title="t('modHealthcareProfessionalSection.healthcareProfessionalNameHeading')"
        >
            <ModProfessionalNamesEditor
                v-model="hpStore.healthcareProfessionalSectionFields.names"
                :needs-review="hpStore.healthcareProfessionalSectionFields.nameReview === NameReviewStatus.NeedsReview"
            />
        </ModAccordion>
        <ModAccordion
            :id="ModHealthcareProfessionalsLeftNavbarSections.HealthcareProfessionalMedicalInfo"
            tone="healthcare"
            :title="t('modHealthcareProfessionalSection.healthcareProfessionalMedicalInfoHeading')"
        >
            <div class="mod-form-grid">
                <ModProfessionalLicenseFields
                    v-model:degrees="hpStore.healthcareProfessionalSectionFields.degrees"
                    v-model:license-review="hpStore.healthcareProfessionalSectionFields.licenseReview"
                />
                <div class="mod-picker">
                    <label
                        for="specialties"
                        class="field-label"
                    >
                        {{ t("modHealthcareProfessionalSection.selectSpecialties") }}
                    </label>
                    <ModSearchBar
                        v-model="hpStore.healthcareProfessionalSectionFields.specialties"
                        data-test-id="mod-healthcare-professional-section-specialties"
                        :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextSpecialties')"
                        :no-match-text="t('modHealthcareProfessionalSection.noSpecialtiesWereFound')"
                        :fields-to-display-callback="specialtiesToDisplayCallback"
                        :default-suggestions="Object.values(Specialty)"
                        @search-input-change="handleSpecialtyInputChange"
                    />
                    <ModTokenList :labels="tokenLabels(hpStore.healthcareProfessionalSectionFields.specialties)" />
                </div>
                <div class="mod-picker">
                    <label
                        for="locales"
                        class="field-label"
                    >
                        {{ t("modHealthcareProfessionalSection.selectLocales") }}
                    </label>
                    <ModSearchBar
                        v-model="hpStore.healthcareProfessionalSectionFields.spokenLanguages"
                        data-test-id="mod-healthcare-professional-section-spoken-locales"
                        :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextLocales')"
                        :no-match-text="t('modHealthcareProfessionalSection.noLocalesWereFound')"
                        :fields-to-display-callback="localesToDisplayCallback"
                        :default-suggestions="Object.values(Locale)"
                        @search-input-change="handleLocaleInputChange"
                    />
                    <ModTokenList :labels="spokenLanguageLabels" />
                </div>
                <NoteInputField
                    v-model="hpStore.healthcareProfessionalSectionFields.additionalInfoForPatients as string"
                    class="mod-span-2"
                    :label="t('modHealthcareProfessionalSection.labelAdditionalNotesForPatients')"
                    :placeholder="t('modHealthcareProfessionalSection.placeholderAdditionalNotesForPatients')"
                    :required="false"
                />
            </div>
        </ModAccordion>
        <ModAccordion
            v-if="moderationScreenStore.editHealthcareProfessionalScreenIsActive()"
            :id="ModHealthcareProfessionalsLeftNavbarSections.HealthcareProfessionalFacilities"
            tone="healthcare"
            :title="t('modHealthcareProfessionalSection.facilities')"
        >
            <ModLinkedFacilities
                v-model="hpStore.healthcareProfessionalSectionFields.facilityIds"
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
import { computed, nextTick, onBeforeMount, onUnmounted, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppToast } from '~/composables/useAppToast'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useModerationScreenStore } from '~/stores/moderationScreenStore'
import { useLocaleStore } from '~/stores/localeStore'
import { Locale, NameReviewStatus, Specialty } from '@findadoc/graphql'
import { useI18n } from '#imports'
import { stableStringify } from '~/utils/stableStringify'
import { filterByCaseInsensitiveIncludes } from '~/utils/moderationSearchUtils'
import { useModerationSubmissionUnsavedStore } from '~/stores/moderationSubmissionUnsavedStore'
import { provideModerationFormEditing, useModerationFormEditing } from '~/composables/useModerationFormMode'
// Keeps track of if the search bar inputs have been autofilled with existing facilities

const toast = useAppToast()
const route = useRoute()
const { t } = useI18n()

const loadingStore = useLoadingStore()

const moderationScreenStore = useModerationScreenStore()
const ownsFormMode = moderationScreenStore.editHealthcareProfessionalScreenIsActive()
  && !moderationScreenStore.editSubmissionScreenIsActive()
const ownedEditing = ownsFormMode ? provideModerationFormEditing(false) : null
const parentEditing = useModerationFormEditing()
const isEditing = computed(() => ownedEditing?.value ?? parentEditing.value)
const localesStore = useLocaleStore()
const hpStore = useHealthcareProfessionalsStore()
const facilitiesStore = useFacilitiesStore()
await facilitiesStore.getFacilities() // Fix a bug where facilities disappear after the user refreshes the page

const isHealthcareProfessionalInitialized: Ref<boolean> = ref(false)

const hpFormState = computed(() =>
    JSON.parse(stableStringify(hpStore.healthcareProfessionalSectionFields)))
const moderationSubmissionUnsavedStore = useModerationSubmissionUnsavedStore()
const { makeNonDirty: makeHpFormNonDirty, tryLeave: tryLeaveHpForm } = useUnsavedChanges({
    data: { source: hpFormState },
    mode: 'update'
})

watch(
    () => hpStore.unsavedChangesResetTick,
    () => {
        makeHpFormNonDirty()
    },
    { flush: 'sync' }
)

const tokenLabels = (values: readonly unknown[] | null | undefined) =>
    (values ?? []).map(item => String(item))
const spokenLanguageLabels = computed(() =>
    (hpStore.healthcareProfessionalSectionFields.spokenLanguages ?? [])
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

onBeforeMount(async () => {
    if (moderationScreenStore.editSubmissionScreenIsActive()) {
        isHealthcareProfessionalInitialized.value = true
        return
    }
    loadingStore.setIsLoading(true)

    // Wait for the route to be fully resolved
    await nextTick()
    // Ensure the route param `id` is available before proceeding
    const id = route.params.id

    if (!id) {
        console.error(t('modHealthcareProfessionalSection.errorMessageHealthcareProfessionalId'))
        toast.error(t('modHealthcareProfessionalSection.errorMessageHealthcareProfessionalId'))
        return
    }

    if (!hpStore.healthcareProfessionalsData.length) {
        await hpStore.getHealthcareProfessionals()
    }

    await nextTick()

    hpStore
        .setSelectedHealthcareProfessional(hpStore.selectedHealthcareProfessionalId)

    await nextTick()

    isHealthcareProfessionalInitialized.value = true
    makeHpFormNonDirty()
    moderationSubmissionUnsavedStore.registerEditFormTryLeave(tryLeaveHpForm)
    loadingStore.setIsLoading(false)

    await nextTick()
})

onUnmounted(() => {
    moderationSubmissionUnsavedStore.registerEditFormTryLeave(null)
})
</script>
