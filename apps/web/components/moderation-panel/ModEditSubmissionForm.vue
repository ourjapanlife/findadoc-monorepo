<template>
    <Loader />
    <div
        v-if="linkedRecordsFailed"
        role="alert"
        class="flex flex-col items-start gap-3 rounded-xl border border-error bg-error/10 p-4 text-primary-text"
        data-testid="mod-submission-linked-records-error"
    >
        <p>{{ t('modSubmissionForm.linkedRecordsFailed') }}</p>
        <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-full border-2 border-primary-text-muted bg-secondary-bg px-5
            py-2 font-bold text-primary-text hover:bg-accent-bg/20"
            data-testid="mod-submission-linked-records-retry"
            @click="retryLinkedRecords"
        >
            {{ t('modSubmissionForm.retryLinkedRecords') }}
        </button>
    </div>
    <div
        v-else
        :data-mod-mode="isEditing ? 'edit' : 'preview'"
    >
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-primary-text-muted">
                {{ isEditing ? t('modForm.editHint') : t('modForm.previewHint') }}
            </p>
            <ModFormModeToggle />
        </div>
        <div class="grid items-start gap-6 landscape:grid-cols-2">
            <section class="mod-sheet">
                <div
                    v-if="!currentExistingHealthcareProfessionals.length"
                    class="mod-picker"
                >
                    <label
                        for="mod-edit-submission-form-facilities"
                        class="field-label mod-edit-only"
                    >
                        {{ t('modSubmissionForm.searchExistingFacilities') }}
                    </label>
                    <ExistingFacilityNotice
                        v-if="matchedFacility && !currentFacilityRelations.length"
                        :facility="matchedFacility"
                        test-id="mod-existing-place"
                        possible
                    >
                        <button
                            type="button"
                            class="btn btn-secondary btn-sm mod-edit-only w-fit"
                            data-testid="mod-use-existing-facility"
                            @click="useMatchedFacility"
                        >
                            {{ t('modSubmissionForm.useExistingFacility') }}
                        </button>
                    </ExistingFacilityNotice>
                    <ModSearchBar
                        v-model="selectedFacilityRelationsModel"
                        input-id="mod-edit-submission-form-facilities"
                        :place-holder-text="t('modHealthcareProfessionalSection.placeholderTextFacilitySearchBar')"
                        :no-match-text="t('modHealthcareProfessionalSection.noFacilitiesWereFound')"
                        :fields-to-display-callback="facilitiesFieldsToDisplayCallback"
                        :default-suggestions="facilitiesStore.facilityData"
                        :searching="applyFacilitySearch.pending.value"
                        @search-input-blur="applyFacilitySearch.cancel"
                        @search-input-change="handleFacilitySearchInputChange"
                    />
                    <ModTokenList :labels="linkedFacilityLabels" />
                </div>
                <div
                    v-show="!currentFacilityRelations.length"
                    class="mod-edit-facility-section"
                >
                    <ModEditFacilitySection />
                </div>
            </section>
            <section class="mod-sheet">
                <div
                    v-if="!currentFacilityRelations.length"
                    class="mod-picker"
                >
                    <label
                        for="mod-edit-submission-form-healthcare-professionals"
                        class="field-label mod-edit-only"
                    >
                        {{ t('modSubmissionForm.searchExistingHealthcareProfessionals') }}
                    </label>
                    <ModSearchBar
                        v-model="selectedHealthcareProfessionalsModel"
                        input-id="mod-edit-submission-form-healthcare-professionals"
                        data-testid="mod-facility-section-doctor-search"
                        :place-holder-text="t('modFacilitySection.placeholderTextHealthcareProfessionalSearchbar')"
                        :no-match-text="t('modFacilitySection.noHealthcareProfessionalFound')"
                        :fields-to-display-callback="healthcareProfessionalsToDisplayCallback"
                        :default-suggestions="healthcareProfessionalsStore.healthcareProfessionalsData"
                        :searching="applyHealthcareProfessionalSearch.pending.value"
                        @search-input-blur="applyHealthcareProfessionalSearch.cancel"
                        @search-input-change="handleHealthcareProfessionalsInputChange"
                    />
                    <ModTokenList :labels="linkedHealthcareProfessionalLabels" />
                </div>
                <div
                    v-show="!currentExistingHealthcareProfessionals.length"
                    class="mod-edit-healthcare-professional-section"
                >
                    <ModEditHealthcareProfessionalSection />
                </div>
                <NoteInputField
                    v-model="currentSubmissionNotes"
                    data-testid="submission-form-notes"
                    :label="t('modSubmissionForm.labelModNoteInput')"
                    :placeholder="t('modSubmissionForm.placeholderTextNoteInput')"
                    :required="false"
                />
            </section>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { type Ref, computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAppToast } from '~/composables/useAppToast'
import { useModerationSubmissionsStore } from '~/stores/moderationSubmissionsStore'
import type { Submission,
    MutationUpdateSubmissionArgs,
    Facility,
    HealthcareProfessional } from '@findadoc/graphql'
import { Gender } from '@findadoc/graphql'
import { useI18n } from '#imports'
import { stableStringify } from '~/utils/stableStringify'
import { returnWithSuccessToast } from '~/composables/useModerationActionFeedback'
import { guardWithErrorToastAndEffect } from '~/composables/useModerationGuardFeedback'
import { formErrorKey, GENERIC_FORM_ERROR_KEY, translatedFormError } from '~/utils/formErrorMessage'
import { ErrorCode } from '~/typedefs/serverResponse'
import { handleModerationResponseErrors } from '~/composables/useModerationResponseHandling'
import { ModerationSubmissionActionType, useModerationSubmissionActions } from '~/composables/useModerationSubmissionActions'
import { mapIdsToEntities } from '~/utils/moderationSearchUtils'
import { fetchFacilityById, fetchHealthcareProfessionalsWithCount } from '~/utils/graphqlHelpers'
import { useDirectoryPickerSearch } from '~/composables/useDirectoryPickerSearch'
import { useExistingFacilityMatch } from '~/composables/useExistingFacilityMatch'
import { formatFirstLocalizedFullName } from '~/utils/nameUtils'
import { hasBothProfessionalNames, namesFromSubmittedName } from '~/utils/professionalNames'
import { leaveToModerationDashboard } from '~/utils/moderationUtils'
import { provideModerationFormEditing } from '~/composables/useModerationFormMode'
import {
    hasRequiredHealthcareProfessionalSelections,
    validateModerationFacilityFields
} from '~/utils/moderationFormValidationUtils'

const toast = useAppToast()
const { t, te } = useI18n()
const router = useRouter()

const moderationSubmissionStore = useModerationSubmissionsStore()
const { moderationSubmissionAction, runModerationSubmissionAction } = useModerationSubmissionActions()
const modalStore = useModalStore()
const screenStore = useModerationScreenStore()
const loadingStore = useLoadingStore()
const facilitiesStore = useFacilitiesStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()
const { facilitySectionFields } = storeToRefs(facilitiesStore)
const { healthcareProfessionalSectionFields } = storeToRefs(healthcareProfessionalsStore)

const currentSubmissionNotes = ref('')
const editing = provideModerationFormEditing(false)
const isEditing = computed(() => editing.value)

// Single reactive snapshot for useUnsavedChanges (plugin shows confirmation on browser back / router leave).
const formState = computed(() => ({
    facility: JSON.parse(stableStringify(facilitySectionFields.value)),
    hp: JSON.parse(stableStringify(healthcareProfessionalSectionFields.value)),
    notes: currentSubmissionNotes.value
}))
const moderationSubmissionUnsavedStore = useModerationSubmissionUnsavedStore()
const { makeNonDirty, isDirty, tryLeave } = useUnsavedChanges({
    data: { source: formState },
    mode: 'update'
})
watch(isDirty, dirty => moderationSubmissionUnsavedStore.setEditSubmissionFormDirty(dirty), {
    immediate: true,
    flush: 'sync'
})

const isEditSubmissionFormInitialized: Ref<boolean> = ref(false)
const lastHandledActionId: Ref<number> = ref(0)
const submissionBeforeChanges: Ref<Submission | undefined> = ref(undefined)

// Keeps track of existing facilities related to new healthcare professional submission
const currentFacilityRelations: Ref<Facility[]> = ref([])
// Keeps track of existing healthcare professionals related to new facility submission
const currentExistingHealthcareProfessionals: Ref<HealthcareProfessional[]> = ref([])
const linkedFacilityLabels = computed(() =>
    currentFacilityRelations.value.map(facility =>
        [facility.nameEn, facility.nameJa].filter(Boolean).join(' · ')))
const linkedHealthcareProfessionalLabels = computed(() =>
    currentExistingHealthcareProfessionals.value.map(healthcareProfessional =>
        [healthcareProfessional.names[0]?.lastName, healthcareProfessional.names[0]?.firstName]
            .filter(Boolean)
            .join(' ')))
const selectedFacilityRelationsModel = computed({
    get: () => currentFacilityRelations.value,
    set: (newValue: Facility[]) => {
        currentFacilityRelations.value = newValue
        if (isEditSubmissionFormInitialized.value) {
            healthcareProfessionalsStore.healthcareProfessionalSectionFields.facilityIds = newValue.map(facility => facility.id)
        }
    }
})
const selectedHealthcareProfessionalsModel = computed({
    get: () => currentExistingHealthcareProfessionals.value,
    set: (newValue: HealthcareProfessional[]) => {
        currentExistingHealthcareProfessionals.value = newValue
        if (isEditSubmissionFormInitialized.value) {
            facilitiesStore.facilitySectionFields.healthcareProfessionalIds = newValue.map(
                healthcareProfessional => healthcareProfessional.id
            )
        }
    }
})

const { match: matchedFacility } = useExistingFacilityMatch(
    () => facilitiesStore.facilitySectionFields.googlemapsURL
)

function useMatchedFacility() {
    const match = matchedFacility.value
    if (!match) return
    const known = facilitiesStore.facilityData.find(facility => facility.id === match.id)
    selectedFacilityRelationsModel.value = [known ?? {
        id: match.id,
        nameEn: match.nameEn,
        nameJa: match.nameJa
    } as Facility]
}

const applyFacilitySearch = useDirectoryPickerSearch(
    query => facilitiesStore.searchFacilities(query)
)
const handleFacilitySearchInputChange = (filteredItems: Ref<Facility[]>, inputValue: string) => {
    applyFacilitySearch(filteredItems, inputValue)
    if (inputValue.trim() === '') {
        return
    }

    if (currentFacilityRelations.value.length) {
        facilitiesStore.resetFacilitySectionFields()
        return
    }

    if (!currentFacilityRelations.value.length) {
        initializeSubmissionFormValues(moderationSubmissionStore.selectedSubmissionData)
        return
    }
}

const facilitiesFieldsToDisplayCallback = (item: Facility) => [item.nameEn, item.nameJa]

const applyHealthcareProfessionalSearch = useDirectoryPickerSearch(
    query => healthcareProfessionalsStore.searchHealthcareProfessionals(query)
)
const handleHealthcareProfessionalsInputChange = (filteredItems: Ref<HealthcareProfessional[]>, inputValue: string) => {
    applyHealthcareProfessionalSearch(filteredItems, inputValue)
    if (inputValue.trim() === '') {
        return
    }

    if (currentExistingHealthcareProfessionals.value.length) {
        healthcareProfessionalsStore.resetHealthcareProfessionalSectionFields()
        return
    }

    if (!currentExistingHealthcareProfessionals.value.length) {
        initializeSubmissionFormValues(moderationSubmissionStore.selectedSubmissionData)
        return
    }
}
const healthcareProfessionalsToDisplayCallback = (healthcareProfessional: HealthcareProfessional) =>
    [formatFirstLocalizedFullName(healthcareProfessional.names)]

const validateFacilityFields = () =>
    validateModerationFacilityFields(facilitiesStore.facilitySectionFields)

const validateHealthcareProfessionalFields = () => {
    const healthcareProfessionalFields = healthcareProfessionalsStore.healthcareProfessionalSectionFields
    const facilitySectionFields = facilitiesStore.facilitySectionFields

    const areNamesSelectedToFacility: boolean
        = healthcareProfessionalFields.names.length > 0
          || facilitySectionFields.healthcareProfessionalIds.length > 0
    return areNamesSelectedToFacility
      && hasRequiredHealthcareProfessionalSelections(healthcareProfessionalFields)
}

// Approval needs the romaji name and the Japanese name (#282).
const validateHealthcareProfessionalNames = () => {
    const healthcareProfessionalFields = healthcareProfessionalsStore.healthcareProfessionalSectionFields
    return hasBothProfessionalNames(healthcareProfessionalFields.names)
}

// Manual deep copy function for submission data
function createSubmissionDeepCopy(submissionData: Submission): Submission {
    return {
        ...submissionData,
        facility: submissionData.facility
            ? {
                ...submissionData.facility,
                contact: submissionData.facility.contact
                    ? {
                        ...submissionData.facility.contact,
                        address: submissionData.facility.contact.address
                            ? { ...submissionData.facility.contact.address }
                            : null
                    }
                    : undefined,
                healthcareProfessionalIds: [...submissionData.facility.healthcareProfessionalIds]
            }
            : undefined,
        healthcareProfessionals: submissionData.healthcareProfessionals?.map(hp => ({
            ...hp,
            names: hp.names.map(name => ({ ...name })),
            degrees: hp.degrees ? [...hp.degrees] : [],
            specialties: hp.specialties ? [...hp.specialties] : [],
            spokenLanguages: hp.spokenLanguages ? [...hp.spokenLanguages] : [],
            facilityIds: hp.facilityIds ? [...hp.facilityIds] : []
        })) || []
    }
}

// Only the latest fill may set the linked records, so a slow answer for an older submission is dropped.
let linkedRecordLoads = 0

/**
 * The pickers keep only the first page in memory. After a reload a linked clinic or professional
 * outside it would look unlinked, and approving would treat it as new, so those are read by id.
 */
async function loadMissingLinkedRecords(): Promise<boolean> {
    const load = ++linkedRecordLoads
    const missingFacilityIds = healthcareProfessionalSectionFields.value.facilityIds
        .filter(id => !currentFacilityRelations.value.some(facility => facility.id === id))
    const missingProfessionalIds = facilitySectionFields.value.healthcareProfessionalIds
        .filter(id => !currentExistingHealthcareProfessionals.value.some(professional => professional.id === id))
    if (!missingFacilityIds.length && !missingProfessionalIds.length) {
        return true
    }
    try {
        const [facilities, professionals] = await Promise.all([
            Promise.all(missingFacilityIds.map(id => fetchFacilityById(id))),
            missingProfessionalIds.length
                ? fetchHealthcareProfessionalsWithCount({
                    ids: missingProfessionalIds,
                    offset: 0,
                    limit: missingProfessionalIds.length
                })
                : Promise.resolve({ filteredSearchResults: [] as HealthcareProfessional[] })
        ])
        // A newer fill decides for itself.
        if (load !== linkedRecordLoads) {
            return true
        }
        currentFacilityRelations.value = mapIdsToEntities(
            healthcareProfessionalSectionFields.value.facilityIds,
            [
                ...currentFacilityRelations.value,
                ...facilities.filter((facility): facility is Facility => facility !== undefined)
            ]
        )
        currentExistingHealthcareProfessionals.value = mapIdsToEntities(
            facilitySectionFields.value.healthcareProfessionalIds,
            [...currentExistingHealthcareProfessionals.value, ...professionals.filteredSearchResults]
        )
        return true
    } catch (error) {
        console.error(`Error fetching linked records: ${JSON.stringify(error)}`)
        return false
    }
}

// Set when a linked clinic or professional could not load. Approving then would treat the link as new.
const linkedRecordsFailed = ref(false)

async function retryLinkedRecords() {
    linkedRecordsFailed.value = false
    loadingStore.setIsLoading(true)
    linkedRecordsFailed.value = !await loadMissingLinkedRecords()
    loadingStore.setIsLoading(false)
}

function initializeSubmissionFormValues(submissionData: Submission | undefined) {
    // Create a deep copy of the submission data to preserve the original state
    if (submissionData) {
        submissionBeforeChanges.value = createSubmissionDeepCopy(submissionData)
    }

    const submittedHealthcareProfessionalName
        = submissionData?.healthcareProfessionalName?.split(' ') ?? []

    if (submissionData && submissionData.notes) {
        currentSubmissionNotes.value = submissionData.notes
    }

    const facilitySectionFields = facilitiesStore.facilitySectionFields
    const healthcareProfessionalSections
        = healthcareProfessionalsStore.healthcareProfessionalSectionFields

    // Facility fields
    facilitySectionFields.nameEn = submissionData?.facility?.nameEn ?? ''
    facilitySectionFields.nameJa = submissionData?.facility?.nameJa ?? ''
    facilitySectionFields.phone = submissionData?.facility?.contact?.phone ?? ''
    facilitySectionFields.email = submissionData?.facility?.contact?.email ?? ''
    facilitySectionFields.website = submissionData?.facility?.contact?.website ?? ''
    facilitySectionFields.postalCode
        = submissionData?.facility?.contact?.address?.postalCode ?? ''
    facilitySectionFields.prefectureEn
        = submissionData?.facility?.contact?.address?.prefectureEn ?? ''
    facilitySectionFields.cityEn
        = submissionData?.facility?.contact?.address?.cityEn ?? ''
    facilitySectionFields.addressLine1En
        = submissionData?.facility?.contact?.address?.addressLine1En ?? ''
    facilitySectionFields.addressLine2En
        = submissionData?.facility?.contact?.address?.addressLine2En ?? ''
    facilitySectionFields.prefectureJa
        = submissionData?.facility?.contact?.address?.prefectureJa ?? ''
    facilitySectionFields.cityJa
        = submissionData?.facility?.contact?.address?.cityJa ?? ''
    facilitySectionFields.cityId = ''
    facilitySectionFields.addressLine1Ja
        = submissionData?.facility?.contact?.address?.addressLine1Ja ?? ''
    facilitySectionFields.addressLine2Ja
        = submissionData?.facility?.contact?.address?.addressLine2Ja ?? ''
    facilitySectionFields.mapLatitude
        = submissionData?.facility?.mapLatitude?.toString() ?? ''
    facilitySectionFields.mapLongitude
        = submissionData?.facility?.mapLongitude?.toString() ?? ''
    facilitySectionFields.online = submissionData?.facility?.online === true

    facilitySectionFields.googlemapsURL
        = submissionData?.facility?.contact?.googleMapsUrl
          ?? submissionData?.googleMapsUrl
          ?? ''

    facilitySectionFields.healthcareProfessionalIds = submissionData?.facility?.healthcareProfessionalIds ?? []
    // A searched person may sit outside the preloaded page. Keep the object already picked.
    currentExistingHealthcareProfessionals.value = mapIdsToEntities(
        facilitySectionFields.healthcareProfessionalIds,
        [
            ...currentExistingHealthcareProfessionals.value,
            ...healthcareProfessionalsStore.healthcareProfessionalsData
        ]
    )

    // Healthcare Professionals fields
    const hp = submissionData?.healthcareProfessionals?.[0]

    // The submitter's free-text name goes under the locale its script belongs to (#282).
    healthcareProfessionalSections.names
        = hp?.names ?? namesFromSubmittedName(submittedHealthcareProfessionalName)

    healthcareProfessionalSections.facilityIds = [...(hp?.facilityIds ?? [])]
    // A searched clinic may sit outside the preloaded page. Keep the object already picked.
    currentFacilityRelations.value = mapIdsToEntities(
        healthcareProfessionalSections.facilityIds,
        [
            ...currentFacilityRelations.value,
            ...facilitiesStore.facilityData
        ]
    )

    if (submissionData?.healthcareProfessionals?.[0]?.additionalInfoForPatients) {
        healthcareProfessionalSections.additionalInfoForPatients
            = submissionData.healthcareProfessionals[0].additionalInfoForPatients
    }

    if (submissionData?.healthcareProfessionals?.[0]?.degrees) {
        healthcareProfessionalSections.degrees
            = submissionData.healthcareProfessionals[0].degrees
    }
    if (submissionData?.healthcareProfessionals?.[0]?.specialties) {
        healthcareProfessionalSections.specialties
            = submissionData.healthcareProfessionals[0].specialties
    }
    // A draft without a gender is UNKNOWN, like a new professional (#224).
    healthcareProfessionalSections.gender = hp?.gender ?? Gender.Unknown

    // Always include submissionData.spokenLanguages, append hp.spokenLanguages, remove duplicates
    healthcareProfessionalSections.spokenLanguages = [
        ...(submissionData?.spokenLanguages ?? []),
        ...(hp?.spokenLanguages ?? [])
    ].filter((value, index, self) => self.indexOf(value) === index)
}

// •
// • submissionFormFieldsBeforeChanges (“before” snapshot)
// • facilitiesStore.facilitySectionFields → facility
// • healthcareProfessionalsStore.healthcareProfessionalSectionFields → hp
async function saveSubmissionDraft(
    e: Event,
    options: {
        showSuccessToast?: boolean
        shouldExitAfterUpdate?: boolean
        shouldResetModalRefsAfterUpdate?: boolean
    } = {}
): Promise<boolean> {
    e.preventDefault()

    const id = moderationSubmissionStore.selectedSubmissionId || ''
    if (!id) {
        toast.error(t('modSubmissionForm.errorMessageFacilityId'))
        console.error(t('modSubmissionForm.errorMessageFacilityId'))
        await resetModalRefs()
        return false
    }

    const facilitySubmissionUpdate = {
        nameEn: facilitiesStore.facilitySectionFields.nameEn,
        nameJa: facilitiesStore.facilitySectionFields.nameJa,
        contact: {
            email: facilitiesStore.facilitySectionFields.email,
            phone: facilitiesStore.facilitySectionFields.phone,
            website: facilitiesStore.facilitySectionFields.website,
            ...(facilitiesStore.facilitySectionFields.online === true
                ? { googleMapsUrl: '' }
                : {
                    googleMapsUrl: facilitiesStore.facilitySectionFields.googlemapsURL,
                    address: {
                        postalCode: facilitiesStore.facilitySectionFields.postalCode,
                        prefectureEn: facilitiesStore.facilitySectionFields.prefectureEn,
                        cityEn: facilitiesStore.facilitySectionFields.cityEn,
                        addressLine1En: facilitiesStore.facilitySectionFields.addressLine1En,
                        addressLine2En: facilitiesStore.facilitySectionFields.addressLine2En,
                        prefectureJa: facilitiesStore.facilitySectionFields.prefectureJa,
                        cityJa: facilitiesStore.facilitySectionFields.cityJa,
                        addressLine1Ja: facilitiesStore.facilitySectionFields.addressLine1Ja,
                        addressLine2Ja: facilitiesStore.facilitySectionFields.addressLine2Ja
                    }
                })
        },
        healthcareProfessionalIds: facilitiesStore.facilitySectionFields.healthcareProfessionalIds,
        ...(facilitiesStore.facilitySectionFields.online === true
            ? { online: true, mapLatitude: null, mapLongitude: null }
            : {
                mapLatitude: parseFloat(facilitiesStore.facilitySectionFields.mapLatitude),
                mapLongitude: parseFloat(facilitiesStore.facilitySectionFields.mapLongitude),
                ...(facilitiesStore.facilitySectionFields.cityId
                    ? { cityId: facilitiesStore.facilitySectionFields.cityId }
                    : {})
            })
    }

    const healthcareProfessionalUpdate = [
        {
            additionalInfoForPatients: healthcareProfessionalsStore.healthcareProfessionalSectionFields.additionalInfoForPatients,
            degrees: healthcareProfessionalsStore.healthcareProfessionalSectionFields.degrees,
            specialties: healthcareProfessionalsStore.healthcareProfessionalSectionFields.specialties,
            gender: healthcareProfessionalsStore.healthcareProfessionalSectionFields.gender,
            spokenLanguages: healthcareProfessionalsStore.healthcareProfessionalSectionFields.spokenLanguages,
            names: healthcareProfessionalsStore.healthcareProfessionalSectionFields.names,
            facilityIds: healthcareProfessionalsStore.healthcareProfessionalSectionFields.facilityIds
        }
    ]

    const submissionInputVariables: MutationUpdateSubmissionArgs = {
        id,
        input: {
            isUnderReview: true,
            facility: facilitySubmissionUpdate,
            healthcareProfessionals: healthcareProfessionalUpdate,
            notes: currentSubmissionNotes.value
        }
    }

    const result = await moderationSubmissionStore.updateSubmission(submissionInputVariables)
    if (handleModerationResponseErrors(result, toast, t, te)) {
        await resetModalRefs()
        return false
    }

    const updatedSubmission = result.data?.updateSubmission
    if (!updatedSubmission) {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        await resetModalRefs()
        return false
    }

    const selectedCityId = facilitiesStore.facilitySectionFields.cityId
    initializeSubmissionFormValues(updatedSubmission)
    facilitiesStore.facilitySectionFields.cityId = selectedCityId
    makeNonDirty()

    if (options.showSuccessToast ?? true) {
        returnWithSuccessToast(result, toast, t, 'modSubmissionForm.successMessageUpdated')
    }
    if (options.shouldExitAfterUpdate) {
        await leaveToModerationDashboard(router, screenStore, modalStore, 'submissions')
        return true
    }

    if (options.shouldResetModalRefsAfterUpdate) {
        await resetModalRefs()
    }
    return true
}

async function confirmAndApproveSubmission(e?: Event) {
    // stop the form submitting before we validate
    e?.preventDefault()

    const selectedSubmissionData = moderationSubmissionStore.selectedSubmissionData
    // This prevents submission of an already approved submission the backend does this but as an extra visual and check
    if (selectedSubmissionData && selectedSubmissionData.isApproved) {
        toast.info(translatedFormError(t, formErrorKey.submissionAlreadyApproved))
        await resetModalRefs()
        return
    }

    const faciliyAlreadyExistsInOurDatabase = currentFacilityRelations.value.length
    const healthcareProfessionalAlreadyExistsInOurDatabase = currentExistingHealthcareProfessionals.value.length

    // This shows a toast and returns if the facility fields arent valid
    if (!faciliyAlreadyExistsInOurDatabase) {
        const isValidFacility = validateFacilityFields()
        if (await guardWithErrorToastAndEffect(
            !isValidFacility,
            toast,
            t,
            formErrorKey.facilityFieldsIncomplete,
            resetModalRefs
        )) {
            return
        }
    }

    if (!healthcareProfessionalAlreadyExistsInOurDatabase) {
        const isValidHealthcareProfessional = validateHealthcareProfessionalFields()
        if (await guardWithErrorToastAndEffect(
            !isValidHealthcareProfessional,
            toast,
            t,
            formErrorKey.healthcareProfessionalFieldsIncomplete,
            resetModalRefs
        )) {
            return
        }
        const hasBothNames = validateHealthcareProfessionalNames()
        if (await guardWithErrorToastAndEffect(
            !hasBothNames,
            toast,
            t,
            formErrorKey.professionalNamesRequired,
            resetModalRefs
        )) {
            return
        }
    }

    try {
        // This updates submission before approving since moderators might not think to update first
        const draftSaved = await saveSubmissionDraft(
            new Event('submit', { bubbles: false, cancelable: true }),
            { showSuccessToast: false }
        )
        if (!draftSaved) {
            return
        }
        const result = await moderationSubmissionStore.approveSubmission()
        await resetModalRefs()
        if (!result) {
            toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
            return
        }
        const errorCodes = result.errors?.map(error => error.code) ?? []
        const alreadyApproved = errorCodes.length > 0
          && errorCodes.every(code => code === ErrorCode.SUBMISSION_ALREADY_APPROVED)
        if (alreadyApproved) {
            returnWithSuccessToast(result, toast, t, 'modSubmissionForm.successMessageApproved')
            await leaveToModerationDashboard(router, screenStore, modalStore, 'submissions')
            return
        }
        if (handleModerationResponseErrors(result, toast, t, te)) {
            return
        }
        if (!result.data?.updateSubmission) {
            toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
            return
        }
        returnWithSuccessToast(result, toast, t, 'modSubmissionForm.successMessageApproved')
        await leaveToModerationDashboard(router, screenStore, modalStore, 'submissions')
    } catch {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        await resetModalRefs()
    }
}

const resetModalRefs = async () => {
    await nextTick()
    modalStore.hideModal()
}

const rejectSubmission = async () => {
    const result = await moderationSubmissionStore.rejectSubmission()
    await resetModalRefs()
    if (!result) {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        return
    }
    if (handleModerationResponseErrors(result, toast, t, te)) {
        return
    }
    if (!result.data?.updateSubmission) {
        toast.error(translatedFormError(t, GENERIC_FORM_ERROR_KEY))
        return
    }
    toast.success(t('modSubmissionForm.submissionRejected'))
    await leaveToModerationDashboard(router, screenStore, modalStore, 'submissions')
}

watch(
    moderationSubmissionAction,
    action => {
        if (!action || action.id === lastHandledActionId.value) {
            return
        }

        lastHandledActionId.value = action.id

        if (linkedRecordsFailed.value && action.type === ModerationSubmissionActionType.Approve) {
            toast.error(t('modSubmissionForm.linkedRecordsFailed'))
            return
        }

        switch (action.type) {
            case ModerationSubmissionActionType.Approve:
                useNuxtApp().$withConfirmation(async () => {
                    // Awaited so the dialog keeps its spinner until the request finishes.
                    await runModerationSubmissionAction(action.type, confirmAndApproveSubmission)
                }, {
                    title: t('modEditSubmissionTopNav.approve'),
                    message: t('modSubmissionForm.submissionConfirmationMessage'),
                    textConfirm: t('modSubmissionForm.submissionConfirmationAcceptanceButton'),
                    textCancel: t('common.cancel')
                })
                return
            case ModerationSubmissionActionType.Reject:
                useNuxtApp().$withConfirmation(async () => {
                    // Awaited so the dialog keeps its spinner until the request finishes.
                    await runModerationSubmissionAction(action.type, rejectSubmission)
                }, {
                    title: t('modEditSubmissionTopNav.reject'),
                    message: t('modSubmissionForm.rejectSubmissionConfirmationMessage'),
                    textConfirm: t('modSubmissionForm.rejectSubmissionConfirmationButton'),
                    textCancel: t('common.cancel'),
                    destructive: true
                })
                return
            case ModerationSubmissionActionType.UpdateAndExit:
                void runModerationSubmissionAction(action.type, () => saveSubmissionDraft(
                    new Event('submit', { bubbles: false, cancelable: true }),
                    { shouldExitAfterUpdate: true }
                ))
                return
            case ModerationSubmissionActionType.Update:
                void runModerationSubmissionAction(action.type, () => saveSubmissionDraft(
                    new Event('submit', { bubbles: false, cancelable: true }),
                    { shouldResetModalRefsAfterUpdate: true }
                ))
        }
    }
)

// Bumped on unmount, so a mount that finishes loading after the user left registers nothing.
let mountGeneration = 0

onUnmounted(() => {
    mountGeneration++
    moderationSubmissionUnsavedStore.registerEditFormTryLeave(null)
    moderationSubmissionUnsavedStore.setEditSubmissionFormDirty(false)
})

onMounted(async () => {
    const generation = ++mountGeneration
    isEditSubmissionFormInitialized.value = false

    loadingStore.setIsLoading(true)

    if (!moderationSubmissionStore.submissionsData.length) {
        await moderationSubmissionStore.getSubmissions()
    }

    // This will fetch the facilities if sent here by link or a page is refreshed
    if (!facilitiesStore.facilityData.length) {
        await facilitiesStore.getFacilities()
    }

    // This will fetch the healthcare professionals if sent here by link or a page is refreshed
    if (!healthcareProfessionalsStore.healthcareProfessionalsData.length) {
        await healthcareProfessionalsStore.getHealthcareProfessionals()
    }

    moderationSubmissionStore.filterSelectedSubmission(moderationSubmissionStore.selectedSubmissionId)

    await nextTick()

    initializeSubmissionFormValues(moderationSubmissionStore.selectedSubmissionData)
    linkedRecordsFailed.value = !await loadMissingLinkedRecords()
    if (generation !== mountGeneration) {
        return
    }

    await nextTick()
    makeNonDirty()

    await nextTick()
    if (generation !== mountGeneration) {
        return
    }

    isEditSubmissionFormInitialized.value = true
    moderationSubmissionUnsavedStore.registerEditFormTryLeave(tryLeave)
    loadingStore.setIsLoading(false)
})
</script>
