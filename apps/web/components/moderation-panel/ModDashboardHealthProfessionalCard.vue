<template>
    <div
        :class="[
            'mod-dashboard-healthcare-professional-card',
            'flex w-full items-center gap-3 rounded-lg border border-accent-bg bg-secondary-bg px-3 py-2.5',
            (isEditable && chosenLocaleIndex === 0)
                ? 'border-primary'
                : '',
        ]"
    >
        <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="flex w-full min-w-0 items-center gap-3">
                <div class="w-8 shrink-0">
                    <SVGProfileIcon
                        role="img"
                        alt="profile icon"
                        title="profile icon"
                        class="profile-icon inline h-8 w-8 stroke-primary stroke-1"
                    />
                </div>
                <div
                    v-if="healthcareProfessionalsRelatedToFacility && healthcareProfessional"
                    class="min-w-0 flex-1"
                >
                    <div class="flex min-w-0 flex-col gap-1">
                        <div
                            id="healthcare-professional-related-to-facility-name-display-container"
                            class="flex flex-wrap items-baseline gap-x-2 font-semibold text-primary-text"
                        >
                            <span>{{ healthcareProfessionalsStore
                                .displayChosenLocaleForHealthcareProfessional(healthcareProfessional)?.lastName }}</span>
                            <span>
                                {{ healthcareProfessionalsStore
                                    .displayChosenLocaleForHealthcareProfessional(healthcareProfessional)?.firstName }}
                            </span>
                            <span
                                v-show="healthcareProfessionalsStore
                                    .displayChosenLocaleForHealthcareProfessional(healthcareProfessional)?.middleName"
                            >
                                {{ healthcareProfessionalsStore
                                    .displayChosenLocaleForHealthcareProfessional(healthcareProfessional)?.middleName }}
                            </span>
                        </div>
                        <span class="text-xs text-primary-text-muted">
                            {{ healthcareProfessional.id }}
                        </span>
                        <div>
                            <div
                                id="healthcare-professional-related-to-facility-formatted-locale-spoken"
                                class="flex flex-col gap-1"
                            >
                                <div class="flex flex-col gap-1">
                                    <span class="text-xs font-semibold text-primary-text-muted">
                                        {{ t('modDashboardHealthcareProfessionalCard.spokenLanguages') }}
                                    </span>
                                    <div class="flex flex-wrap gap-1">
                                        <div
                                            v-for="(spokenLanguage, indexOfLocale)
                                                in healthcareProfessional.spokenLanguages"
                                            :key="`${spokenLanguage}-${indexOfLocale}`"
                                            class="healthcare-professional-related-to-facility-formatted-spoken-language
                                                chip"
                                        >
                                            <span>
                                                {{ localeStore.formatLanguageCodeToSimpleText(
                                                    spokenLanguage) }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    v-if="healthcareProfessionalNameByLocale"
                    id="healthcare-professional-name-by-locale-container"
                    class="flex min-w-0 flex-1 flex-col gap-0.5"
                >
                    <p
                        id="healthcare-professional-name-display-container"
                        class="flex flex-wrap items-baseline gap-x-2 text-primary-text"
                    >
                        <span
                            class="font-semibold"
                            data-testid="healthcare-professional-card-last-name"
                        >
                            {{ healthcareProfessionalNameByLocale.lastName }}
                        </span>
                        <span>{{ healthcareProfessionalNameByLocale.firstName }}</span>
                        <span v-if="healthcareProfessionalNameByLocale.middleName">
                            {{ healthcareProfessionalNameByLocale.middleName }}
                        </span>
                    </p>
                    <p
                        id="healthcare-professional-name-locale"
                        class="text-sm text-primary-text-muted"
                        data-testid="healthcare-professional-name-card-locale"
                    >
                        {{ localeStore.formatLanguageCodeToSimpleText(
                            healthcareProfessionalNameByLocale.locale) }}
                    </p>
                </div>
                <div
                    v-if="isEditOrCreateFacility
                        && !isHealthcareProfessionalReadyForRemoval(healthcareProfessional?.id)"
                    id="remove-related-healthcare-professional-to-facility"
                    class="mod-edit-only flex w-8 shrink-0 items-center justify-center cursor-pointer
                        font-bold text-secondary text-sm p-1"
                    role="button"
                    tabindex="0"
                    aria-label="Remove healthcare professional from facility"
                    @click="() => removeHealthcareProfessional(healthcareProfessional?.id)"
                    @keydown.enter="() => removeHealthcareProfessional(healthcareProfessional?.id)"
                    @keydown.space.prevent="() => removeHealthcareProfessional(healthcareProfessional?.id)"
                >
                    <SVGTrashCan v-show="showTrashCan" />
                </div>

                <div
                    v-if="isEditOrCreateFacility
                        && isHealthcareProfessionalReadyForRemoval(healthcareProfessional?.id)"
                    id="undo-remove-related-healthcare-professional-to-facility"
                    class="mod-edit-only flex w-8 shrink-0 items-center justify-center cursor-pointer
                        font-bold text-secondary text-sm p-1"
                    role="button"
                    tabindex="0"
                    aria-label="Undo removal of healthcare professional from facility"
                    @click="() => undoRemovalOfHealthcareProfessional(healthcareProfessional?.id)"
                    @keydown.enter="() => undoRemovalOfHealthcareProfessional(healthcareProfessional?.id)"
                    @keydown.space.prevent="() => undoRemovalOfHealthcareProfessional(healthcareProfessional?.id)"
                >
                    <SVGUndoIcon class="flex items-center justify-center w-6 h-6" />
                </div>
                <div
                    v-if="isEditOrCreateHealthcareProfessional || isEditSubmission"
                    class="mod-edit-only flex w-8 shrink-0 items-center justify-center
                        cursor-pointer font-bold text-secondary text-sm p-1"
                >
                    <div id="edit-healthcare-professional-button-container">
                        <!-- If the chosen index is not 0 we want them to be able to click the pencil to reorder
                         the locale names to edit that specific name  -->
                        <button
                            v-if="!isEditable || chosenLocaleIndex !== 0"
                            id="edit-healthcare-professional-professional-locale-name"
                            type="button"
                            class="flex items-center justify-center w-6 h-6"
                            @click="() => setChangeToEditable()"
                        >
                            <SVGPencilIcon />
                        </button>
                        <!-- If the chosen index is 0 that is the current locale name chosen being edited  -->
                        <button
                            v-if="isEditable && chosenLocaleIndex === 0"
                            id="close-edit-healthcare-professional-locale-name"
                            class="flex items-center justify-center w-6 h-6"
                            type="button"
                            @click="() => setToUneditable()"
                        >
                            <SVGXCloseIcon />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import SVGTrashCan from '~/assets/icons/trash-can.svg'
import SVGProfileIcon from '~/assets/icons/profile-icon.svg'
import SVGUndoIcon from '~/assets/icons/undo-icon.svg'
import SVGPencilIcon from '~/assets/icons/pencil-edit.svg'
import SVGXCloseIcon from '~/assets/icons/x-close-symbol.svg'
import { useLocaleStore } from '~/stores/localeStore'
import { useFacilitiesStore } from '~/stores/facilitiesStore'
import { useHealthcareProfessionalsStore } from '~/stores/healthcareProfessionalsStore'
import { useModerationScreenStore } from '~/stores/moderationScreenStore'
import {
    RelationshipAction,
    type HealthcareProfessional,
    type LocalizedNameInput,
    type Relationship
} from '@findadoc/graphql'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'

const { t } = useI18n()
const isEditing = useModerationFormEditing()

const localeStore = useLocaleStore()
const facilitiesStore = useFacilitiesStore()
const moderationScreenStore = useModerationScreenStore()
const healthcareProfessionalsStore = useHealthcareProfessionalsStore()

// This checks whether an existing healthcare professional has been added for removal
const isHealthcareProfessionalReadyForRemoval = (id: string = '0') =>
    facilitiesStore.facilitySectionFields.healthProfessionalsRelations
        .find(healthcareProfessionalRelation => healthcareProfessionalRelation.otherEntityId === id
          && healthcareProfessionalRelation.action === RelationshipAction.Delete)

const removeHealthcareProfessional = (id: string = '0') => {
    if (!isEditing.value) return
    if (props.healthcareProfessionalsRelatedToFacility && props.healthcareProfessionalsRelatedToFacility.includes(id)) {
        facilitiesStore.facilitySectionFields.healthProfessionalsRelations
            .push({ otherEntityId: id, action: RelationshipAction.Delete })
        return
    }
    facilitiesStore.facilitySectionFields.healthProfessionalsRelations
        = facilitiesStore.facilitySectionFields.healthProfessionalsRelations
            .filter((healthcareProfessionalRelation: Relationship) => healthcareProfessionalRelation.otherEntityId !== id)
}

const undoRemovalOfHealthcareProfessional = (id: string = '0') => {
    if (!isEditing.value) return
    facilitiesStore.facilitySectionFields.healthProfessionalsRelations
        = facilitiesStore.facilitySectionFields.healthProfessionalsRelations
            .filter((healthcareProfessionalRelation: Relationship) => healthcareProfessionalRelation.otherEntityId !== id)
}
// This changes the component details to editable with an optional parameter to use in the callback function
const setChangeToEditable = () => {
    if (!isEditing.value) return
    if (props.setIsEditableFunction) props.setIsEditableFunction(true)
}

// This changes the component to not editable and does not save the changes
const setToUneditable = () => {
    if (props.setIsEditableFunction) props.setIsEditableFunction(false)
}

const props = withDefaults(defineProps<{
    // The healthcare professional is not created yet if modEditSubmissionForm
    healthcareProfessional?: HealthcareProfessional
    healthcareProfessionalsRelatedToFacility?: string[]
    healthcareProfessionalNameByLocale?: LocalizedNameInput
    /* chosenLocaleIndex checks where in the array the locale name is. If it is 0 it is the one being edited.
    If not it is not being edited we want to display the pencil so it can be changed to be the locale name
    being edited */
    chosenLocaleIndex?: number
    isEditable?: boolean
    setIsEditableFunction?: (param: boolean) => void
    // This is so you can hide the trash can icon in case you just want to display the information of the healthcare professional
    showTrashCan?: boolean
}>(),
                           {
                               showTrashCan: true // This defaults the trash can to being true
                           })

const isEditOrCreateHealthcareProfessional = computed(() => moderationScreenStore.editHealthcareProfessionalScreenIsActive()
  || moderationScreenStore.createHealthcareProfessionalScreenIsActive())
const isEditOrCreateFacility = computed(() => moderationScreenStore.editFacilityScreenIsActive()
  || moderationScreenStore.createFacilityScreenIsActive())
const isEditSubmission = computed(() => moderationScreenStore.editSubmissionScreenIsActive())
</script>
