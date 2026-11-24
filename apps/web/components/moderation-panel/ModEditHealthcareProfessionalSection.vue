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
                <ModSpecialtyPicker
                    v-model="hpStore.healthcareProfessionalSectionFields.specialties"
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
import { computed, nextTick, onUnmounted, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppToast } from '~/composables/useAppToast'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useModerationScreenStore } from '~/stores/moderationScreenStore'
import { useLocaleStore } from '~/stores/localeStore'
import { Locale, NameReviewStatus } from '@findadoc/graphql'
import { useI18n } from '#imports'
import { stableStringify } from '~/utils/stableStringify'
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

const spokenLanguageLabels = computed(() =>
    (hpStore.healthcareProfessionalSectionFields.spokenLanguages ?? [])
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

const routeHealthcareProfessionalId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
// Only the latest load may fill the form, so a slow answer for an older id is dropped.
let healthcareProfessionalSectionLoads = 0

/** Fills the form from the professional in the URL. A reload fetches it by id instead of starting empty. */
async function initializeHealthcareProfessionalSection(id: string) {
    const load = ++healthcareProfessionalSectionLoads
    isHealthcareProfessionalInitialized.value = false
    // Leaving the edit route clears the id before this section unmounts. There is nothing to load.
    if (!id) {
        return
    }

    loadingStore.setIsLoading(true)
    const professional = await hpStore.loadSelectedHealthcareProfessional(id)
    if (load !== healthcareProfessionalSectionLoads) {
        return
    }
    loadingStore.setIsLoading(false)
    if (professional === undefined) {
        toast.error(t('modHealthcareProfessionalSection.errorMessageHealthcareProfessionalId'))
        return
    }

    // Wait for the fields to render before the form counts as clean.
    await nextTick()
    if (load !== healthcareProfessionalSectionLoads) {
        return
    }
    isHealthcareProfessionalInitialized.value = true
    makeHpFormNonDirty()
    moderationSubmissionUnsavedStore.registerEditFormTryLeave(tryLeaveHpForm)
}

// The submission screen fills this section itself. Elsewhere the URL id drives it, so a reload
// or a link to another record loads that record.
const loadsFromRoute = !moderationScreenStore.editSubmissionScreenIsActive()
if (loadsFromRoute) {
    watch(routeHealthcareProfessionalId, initializeHealthcareProfessionalSection, { immediate: true })
} else {
    isHealthcareProfessionalInitialized.value = true
}

onUnmounted(() => {
    // A load still in flight must not fill the next screen, such as a submission's fields, or leave the loader on.
    healthcareProfessionalSectionLoads++
    if (loadsFromRoute) {
        hpStore.cancelSelectedHealthcareProfessionalLoad()
        loadingStore.setIsLoading(false)
    }
    moderationSubmissionUnsavedStore.registerEditFormTryLeave(null)
})
</script>
