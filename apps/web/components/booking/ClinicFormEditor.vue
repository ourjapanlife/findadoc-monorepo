<template>
    <form
        class="card flex flex-col gap-5 p-5 shadow-card landscape:p-6"
        novalidate
        data-testid="clinic-form-editor"
        @submit.prevent="save"
    >
        <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold tracking-tight text-primary-text">
                {{ props.form === null ? t('clinicDashboard.forms.newHeading') : t('clinicDashboard.forms.editHeading') }}
            </h2>
            <p class="text-sm text-primary-text-muted">
                {{ t('clinicDashboard.forms.fixedFields') }}
            </p>
        </div>

        <label class="flex max-w-md flex-col">
            <span class="field-label">{{ t('clinicDashboard.forms.name') }}</span>
            <input
                v-model="name"
                type="text"
                class="field"
                maxlength="80"
                required
                data-testid="clinic-form-name"
            >
        </label>

        <ol class="flex flex-col gap-4">
            <li
                v-for="(question, index) in questions"
                :key="question.key"
                class="flex flex-col gap-4 rounded-lg border border-accent-bg bg-secondary-bg p-4"
                :data-testid="`clinic-form-question-${index}`"
            >
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold text-primary-text">
                        {{ t('clinicDashboard.forms.question', { n: index + 1 }) }}
                    </span>
                    <span class="flex-1" />
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        :disabled="index === 0"
                        @click="move(index, -1)"
                    >
                        {{ t('clinicDashboard.forms.moveUp') }}
                    </button>
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        :disabled="index === questions.length - 1"
                        @click="move(index, 1)"
                    >
                        {{ t('clinicDashboard.forms.moveDown') }}
                    </button>
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm text-error hover:bg-error/10"
                        :disabled="questions.length === 1"
                        @click="questions.splice(index, 1)"
                    >
                        {{ t('clinicDashboard.forms.removeQuestion') }}
                    </button>
                </div>

                <LocalizedLabelInputs
                    v-model="question.labels"
                    :label="t('clinicDashboard.forms.questionText')"
                    :testid="`clinic-form-question-${index}-label`"
                />

                <div class="grid gap-3 landscape:grid-cols-3">
                    <label class="flex flex-col">
                        <span class="field-label">{{ t('clinicDashboard.forms.type') }}</span>
                        <select
                            v-model="question.type"
                            class="field"
                            @change="onTypeChange(question)"
                        >
                            <option
                                v-for="type in FIELD_TYPES"
                                :key="type"
                                :value="type"
                            >
                                {{ t(TYPE_LABEL_KEYS[type]) }}
                            </option>
                        </select>
                    </label>
                    <label class="flex flex-col">
                        <span class="field-label">{{ t('clinicDashboard.forms.step') }}</span>
                        <select
                            v-model="question.stepKey"
                            class="field"
                        >
                            <option
                                v-for="stepKey in STEP_KEYS"
                                :key="stepKey"
                                :value="stepKey"
                            >
                                {{ t(`bookingPage.steps.${stepKey}`) }}
                            </option>
                        </select>
                    </label>
                    <label class="flex flex-col">
                        <span class="field-label">{{ t('clinicDashboard.forms.sensitivity') }}</span>
                        <select
                            v-model="question.sensitivity"
                            class="field"
                        >
                            <option
                                v-for="sensitivity in SENSITIVITIES"
                                :key="sensitivity.value"
                                :value="sensitivity.value"
                            >
                                {{ t(sensitivity.labelKey) }}
                            </option>
                        </select>
                    </label>
                </div>
                <p
                    v-if="question.sensitivity === BookingFieldSensitivity.IdentityDocument"
                    class="-mt-2 text-sm text-primary-text-muted"
                >
                    {{ t('clinicDashboard.forms.identityHelp') }}
                </p>

                <div
                    v-if="question.type === BookingFormFieldType.Number"
                    class="grid gap-3 landscape:grid-cols-3"
                >
                    <label class="flex flex-col">
                        <span class="field-label">{{ t('clinicDashboard.forms.min') }}</span>
                        <input
                            v-model.number="question.min"
                            type="number"
                            class="field"
                        >
                    </label>
                    <label class="flex flex-col">
                        <span class="field-label">{{ t('clinicDashboard.forms.max') }}</span>
                        <input
                            v-model.number="question.max"
                            type="number"
                            class="field"
                        >
                    </label>
                </div>

                <fieldset
                    v-if="question.type === BookingFormFieldType.Select"
                    class="flex flex-col gap-3"
                >
                    <legend class="field-label">
                        {{ t('clinicDashboard.forms.choices') }}
                    </legend>
                    <div
                        v-for="(option, optionIndex) in question.options"
                        :key="option.value"
                        class="flex flex-col gap-2 rounded-lg border border-accent-bg p-3"
                    >
                        <LocalizedLabelInputs
                            v-model="option.labels"
                            :label="t('clinicDashboard.forms.choice', { n: optionIndex + 1 })"
                            :testid="`clinic-form-question-${index}-choice-${optionIndex}`"
                        />
                        <button
                            type="button"
                            class="btn btn-ghost btn-sm self-start text-error hover:bg-error/10"
                            :disabled="question.options.length <= 2"
                            @click="question.options.splice(optionIndex, 1)"
                        >
                            {{ t('clinicDashboard.forms.removeChoice') }}
                        </button>
                    </div>
                    <button
                        type="button"
                        class="btn btn-secondary btn-sm self-start"
                        :disabled="question.options.length >= 20"
                        @click="question.options.push(newOption())"
                    >
                        {{ t('clinicDashboard.forms.addChoice') }}
                    </button>
                </fieldset>

                <label class="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-primary-text">
                    <input
                        v-model="question.required"
                        type="checkbox"
                        class="h-5 w-5 accent-primary"
                    >
                    {{ t('clinicDashboard.forms.required') }}
                </label>
            </li>
        </ol>

        <button
            type="button"
            class="btn btn-secondary self-start"
            :disabled="questions.length >= MAX_QUESTIONS"
            data-testid="clinic-form-add-question"
            @click="questions.push(newQuestion())"
        >
            {{ t('clinicDashboard.forms.addQuestion') }}
        </button>

        <p
            v-if="error"
            class="field-error"
            role="alert"
        >
            {{ error }}
        </p>

        <div class="flex flex-wrap items-center gap-3 border-t border-accent-bg pt-5">
            <button
                type="submit"
                class="btn btn-primary min-w-40"
                :disabled="saving"
                :aria-busy="saving"
                data-testid="clinic-form-save"
            >
                <ButtonSpinner v-if="saving" />
                {{ saving ? t('clinicDashboard.saving') : t('clinicDashboard.forms.save') }}
            </button>
            <button
                type="button"
                class="btn btn-ghost"
                :disabled="saving"
                @click="emit('cancel')"
            >
                {{ t('clinicDashboard.forms.cancel') }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    type BookingFormField,
    type BookingLocalizedText,
    type BookingLocalizedTextInput,
    type ClinicBookingForm,
    type ClinicBookingFormFieldInput
} from '@findadoc/graphql'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import LocalizedLabelInputs from '~/components/booking/LocalizedLabelInputs.vue'
import { CLINIC_LABEL_FALLBACK_LOCALE } from '~/utils/booking/clinicLabels'
import { saveClinicBookingForm } from '~/utils/booking/staffQuery'

/**
 * Writes one clinic intake form (#166). Find a Doc's email, phone, and name
 * questions come first on every form and are not edited here. A save that
 * changes the questions is a new version; requests already sent keep theirs.
 */
const props = defineProps<{
    facilityId: string
    /** The form to edit. Null starts a new one. */
    form: ClinicBookingForm | null
}>()

const emit = defineEmits<{
    saved: [form: ClinicBookingForm]
    cancel: []
}>()

type Labels = Record<string, string>

type DraftOption = { value: string, labels: Labels }

type DraftQuestion = {
    key: string
    id: string
    stepKey: string
    type: BookingFormFieldType
    required: boolean
    sensitivity: BookingFieldSensitivity
    labels: Labels
    min: number | '' | null
    max: number | '' | null
    options: DraftOption[]
}

const FIELD_TYPES = [
    BookingFormFieldType.Text,
    BookingFormFieldType.Textarea,
    BookingFormFieldType.Select,
    BookingFormFieldType.Number,
    BookingFormFieldType.Email,
    BookingFormFieldType.Phone,
    BookingFormFieldType.File
]
const TYPE_LABEL_KEYS: Record<BookingFormFieldType, string> = {
    [BookingFormFieldType.Text]: 'clinicDashboard.forms.types.text',
    [BookingFormFieldType.Textarea]: 'clinicDashboard.forms.types.textarea',
    [BookingFormFieldType.Select]: 'clinicDashboard.forms.types.select',
    [BookingFormFieldType.Number]: 'clinicDashboard.forms.types.number',
    [BookingFormFieldType.Email]: 'bookingPage.fields.email',
    [BookingFormFieldType.Phone]: 'bookingPage.fields.phone',
    [BookingFormFieldType.File]: 'clinicDashboard.forms.types.file'
}
const STEP_KEYS = ['contact', 'visit', 'documents']
const SENSITIVITIES = [
    { value: BookingFieldSensitivity.Standard, labelKey: 'bookingDashboard.sensitivity.standard' },
    { value: BookingFieldSensitivity.Medical, labelKey: 'bookingDashboard.sensitivity.medical' },
    { value: BookingFieldSensitivity.IdentityDocument, labelKey: 'bookingDashboard.sensitivity.identityDocument' }
]
const MAX_QUESTIONS = 30

const { t } = useI18n()
const name = ref(props.form?.name ?? '')
const questions = ref<DraftQuestion[]>(props.form?.fields.map(draftFromField) ?? [newQuestion()])
const saving = ref(false)
const error = ref('')

/** A short id that stays with the question across versions, so earlier answers stay under it. */
function randomId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function labelsFrom(list: readonly BookingLocalizedText[]): Labels {
    return Object.fromEntries(list.map(label => [label.locale, label.text]))
}

function labelsInput(labels: Labels): BookingLocalizedTextInput[] {
    return Object.entries(labels)
        .filter(([, text]) => text.trim() !== '')
        .map(([locale, text]) => ({ locale, text: text.trim() }))
}

function hasEnglish(labels: Labels): boolean {
    return (labels[CLINIC_LABEL_FALLBACK_LOCALE] ?? '').trim() !== ''
}

function newOption(): DraftOption {
    return { value: randomId('c'), labels: {} }
}

function newQuestion(): DraftQuestion {
    return {
        key: randomId('k'),
        id: randomId('q'),
        stepKey: 'visit',
        type: BookingFormFieldType.Text,
        required: false,
        sensitivity: BookingFieldSensitivity.Standard,
        labels: {},
        min: null,
        max: null,
        options: []
    }
}

function draftFromField(field: BookingFormField): DraftQuestion {
    return {
        key: randomId('k'),
        id: field.id,
        stepKey: field.stepKey,
        type: field.type,
        required: field.required,
        sensitivity: field.sensitivity,
        labels: labelsFrom(field.labels),
        min: field.min ?? null,
        max: field.max ?? null,
        options: (field.options ?? []).map(option => ({ value: option.value, labels: labelsFrom(option.labels) }))
    }
}

// A file defaults to identity-document retention. A choice question starts with two choices.
function onTypeChange(question: DraftQuestion): void {
    if (question.type === BookingFormFieldType.File) {
        question.sensitivity = BookingFieldSensitivity.IdentityDocument
        question.stepKey = 'documents'
    } else if (question.sensitivity === BookingFieldSensitivity.IdentityDocument) {
        question.sensitivity = BookingFieldSensitivity.Standard
    }
    if (question.type === BookingFormFieldType.Select && question.options.length < 2) {
        question.options = [newOption(), newOption()]
    }
}

function move(index: number, by: number): void {
    const [question] = questions.value.splice(index, 1)
    if (question !== undefined) {
        questions.value.splice(index + by, 0, question)
    }
}

function bound(value: number | '' | null): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isComplete(): boolean {
    return name.value.trim() !== '' && questions.value.every(question =>
        hasEnglish(question.labels)
        && (question.type !== BookingFormFieldType.Select
          || (question.options.length >= 2 && question.options.every(option => hasEnglish(option.labels)))))
}

function fieldInput(question: DraftQuestion): ClinicBookingFormFieldInput {
    const isNumber = question.type === BookingFormFieldType.Number
    return {
        id: question.id,
        stepKey: question.stepKey,
        type: question.type,
        required: question.required,
        sensitivity: question.sensitivity,
        labels: labelsInput(question.labels),
        min: isNumber ? bound(question.min) : null,
        max: isNumber ? bound(question.max) : null,
        options: question.type === BookingFormFieldType.Select
            ? question.options.map(option => ({ value: option.value, labels: labelsInput(option.labels) }))
            : null
    }
}

async function save(): Promise<void> {
    error.value = ''
    if (!isComplete()) {
        error.value = t('clinicDashboard.forms.incomplete')
        return
    }
    saving.value = true
    const saved = await saveClinicBookingForm({
        facilityId: props.facilityId,
        id: props.form?.id ?? null,
        name: name.value.trim(),
        fields: questions.value.map(fieldInput)
    })
    saving.value = false
    if (saved === null) {
        error.value = t('clinicDashboard.forms.saveFailed')
        return
    }
    emit('saved', saved)
}
</script>
