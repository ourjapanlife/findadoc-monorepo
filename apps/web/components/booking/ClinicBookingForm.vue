<template>
    <div
        data-testid="clinic-booking"
        class="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-10 landscape:px-12"
    >
        <div class="flex items-start justify-between gap-4">
            <header class="flex min-w-0 flex-col gap-3">
                <p class="eyebrow">
                    {{ t('bookingPage.eyebrow') }}
                </p>
                <h1
                    class="page-title-sm"
                    data-testid="clinic-booking-heading"
                >
                    {{ t('bookingPage.heading', { clinic: form.clinicName }) }}
                </h1>
                <p class="text-primary-text-muted">
                    {{ t('bookingPage.lead') }}
                </p>
            </header>
            <LocaleSelector class="shrink-0" />
        </div>

        <div
            v-if="submitted"
            class="card flex flex-col gap-3 p-6"
            data-testid="clinic-booking-success"
        >
            <h2 class="text-lg font-semibold">
                {{ t('bookingPage.successHeading') }}
            </h2>
            <p class="text-primary-text-muted">
                {{ t('bookingPage.successBody') }}
            </p>
            <p
                v-if="submissionId"
                class="text-sm text-primary-text-muted"
            >
                {{ t('bookingPage.reference', { id: submissionId }) }}
            </p>
            <div
                v-if="manageUrl"
                class="flex flex-col gap-1"
            >
                <p class="text-sm">
                    {{ t('bookingPage.manageLinkHelp') }}
                </p>
                <NuxtLink
                    :to="manageUrl"
                    class="break-all text-primary underline"
                    data-testid="clinic-booking-manage-link"
                >
                    {{ t('bookingPage.manageLink') }}
                </NuxtLink>
            </div>
        </div>

        <form
            v-else
            novalidate
            class="card flex flex-col gap-5 p-6"
            data-testid="clinic-booking-form"
            @submit.prevent="onSubmit"
        >
            <Stepper
                v-model="stepIndex"
                :steps="formSteps"
                :validate-leaving="validateLeaving"
                :nav-label="t('bookingPage.stepsNav')"
                :next-label="t('bookingPage.next')"
                :previous-label="t('bookingPage.previous')"
                :progress-label="t('bookingPage.stepOf', {
                    current: stepIndex + 1,
                    total: formSteps.length,
                })"
            >
                <div class="flex flex-col gap-4">
                    <BookingDoctorPicker
                        v-if="showSlot"
                        v-model:practitioner-id="practitionerId"
                        v-model:spoken-languages="spokenLanguages"
                        :practitioners="form.practitioners"
                        :languages="form.languages"
                    />
                    <BookingSlotPicker
                        v-if="showSlot"
                        v-model="selectedStart"
                        :clinic-id="clinicKey"
                        :allowed-durations="form.allowedDurations"
                        :duration-minutes="durationMinutes"
                        :initial-day="query.start"
                        :practitioner-id="practitionerId"
                        :spoken-languages="spokenLanguages"
                        @update:duration-minutes="durationMinutes = $event"
                    />

                    <div
                        v-for="field in visibleFields"
                        :key="field.id"
                        class="flex flex-col"
                    >
                        <label
                            v-if="field.type !== BookingFormFieldType.File"
                            :for="`booking-${field.id}`"
                            class="field-label"
                        >
                            {{ fieldLabel(field) }}
                            <span
                                v-if="!field.required"
                                class="ml-1 font-normal text-primary-text-muted"
                            >({{ t('bookingPage.optional') }})</span>
                        </label>
                        <span
                            v-else
                            class="field-label"
                        >
                            {{ fieldLabel(field) }}
                            <span
                                v-if="!field.required"
                                class="ml-1 font-normal text-primary-text-muted"
                            >({{ t('bookingPage.optional') }})</span>
                        </span>

                        <input
                            v-if="field.type === BookingFormFieldType.Number"
                            :id="`booking-${field.id}`"
                            :value="fieldText(values[field.id])"
                            class="field"
                            type="number"
                            :required="field.required"
                            :min="field.min ?? undefined"
                            :max="field.max ?? undefined"
                            :placeholder="fieldPlaceholder(field)"
                            :data-testid="`clinic-booking-field-${field.id}`"
                            @input="onNumberInput(field.id, $event)"
                            @blur="touch(field.id)"
                        >

                        <input
                            v-else-if="isTextLike(field.type)"
                            :id="`booking-${field.id}`"
                            v-model="values[field.id]"
                            class="field"
                            :type="inputType(field.type)"
                            :required="field.required"
                            :maxlength="field.maxLength ?? undefined"
                            :placeholder="fieldPlaceholder(field)"
                            :autocomplete="autocompleteFor(field)"
                            :data-testid="`clinic-booking-field-${field.id}`"
                            @blur="touch(field.id)"
                        >

                        <textarea
                            v-else-if="field.type === BookingFormFieldType.Textarea"
                            :id="`booking-${field.id}`"
                            v-model="values[field.id]"
                            class="field min-h-28"
                            :required="field.required"
                            :maxlength="field.maxLength ?? undefined"
                            :placeholder="fieldPlaceholder(field)"
                            :data-testid="`clinic-booking-field-${field.id}`"
                            @blur="touch(field.id)"
                        />

                        <label
                            v-else-if="field.type === BookingFormFieldType.File"
                            class="flex h-12 w-full cursor-pointer items-center justify-between gap-3
                                rounded-lg border border-border-strong bg-secondary-bg pl-3 pr-1.5
                                text-sm hover:border-primary"
                        >
                            <input
                                :id="`booking-${field.id}`"
                                type="file"
                                class="sr-only"
                                :accept="field.accept ?? undefined"
                                :capture="field.id === 'selfie' ? 'user' : undefined"
                                :required="field.required && !uploadIds[field.id]"
                                :aria-label="fieldLabel(field)"
                                :data-testid="`clinic-booking-field-${field.id}`"
                                @change="onFileChange(field, $event)"
                            >
                            <span
                                class="min-w-0 truncate"
                                :class="fileNames[field.id] ? 'text-primary-text' : 'text-primary-text-muted'"
                            >
                                {{ fileNames[field.id] || filePrompt(field) }}
                            </span>
                            <span
                                class="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3
                                    text-sm font-semibold text-primary-text-inverted"
                            >
                                {{ t('bookingPage.browse') }}
                            </span>
                        </label>

                        <select
                            v-else-if="field.type === BookingFormFieldType.Select"
                            :id="`booking-${field.id}`"
                            v-model="values[field.id]"
                            class="field"
                            :required="field.required"
                            :data-testid="`clinic-booking-field-${field.id}`"
                            @blur="touch(field.id)"
                        >
                            <option value="">
                                {{ t('bookingPage.selectPlaceholder') }}
                            </option>
                            <option
                                v-for="option in field.options ?? []"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label || t(option.labelKey) }}
                            </option>
                        </select>

                        <p
                            v-if="visibleError(field.id)"
                            class="field-error"
                            role="alert"
                        >
                            {{ visibleError(field.id) }}
                        </p>
                    </div>

                    <p
                        v-if="formError"
                        class="field-error"
                        role="alert"
                        data-testid="clinic-booking-form-error"
                    >
                        {{ formError }}
                    </p>
                    <p
                        v-if="isLastStep"
                        class="text-sm text-primary-text-muted"
                    >
                        {{ t('bookingPage.privacyNote') }}
                    </p>
                </div>

                <template #action>
                    <button
                        type="submit"
                        class="btn btn-primary"
                        data-testid="clinic-booking-submit"
                        :disabled="submitting"
                    >
                        {{ submitting ? t('bookingPage.submitting') : t('bookingPage.submit') }}
                    </button>
                </template>
            </Stepper>
        </form>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    BookingFormFieldType,
    type BookingForm,
    type BookingFormField,
    type Locale
} from '@findadoc/graphql'
import { useUnsavedChanges } from '~/composables/useUnsavedChanges'
import {
    clearBookingAutofill,
    isBookingAutofillHost,
    readBookingAutofill,
    writeBookingAutofill
} from '~/utils/booking/localhostAutofill'
import {
    bookingClinicKey,
    isBookingRefusal,
    putBookingFile,
    requestBookingUploadUrl,
    submitBookingForm,
    type BookingRefusal
} from '~/utils/booking/formQuery'
import {
    clearBookingDraftMemory,
    rememberBookingDraft,
    takeBookingDraft
} from '~/utils/booking/draftMemory'
import { localizedPath } from '~/utils/localePath'
import { resolveDuration } from '~/utils/booking/durations'
import type { BookingQuery } from '~/utils/booking/query'
import { useRequestHost } from '~/composables/useClinicLanding'
import Stepper from '~/components/common/Stepper.vue'
import BookingDoctorPicker from '~/components/booking/BookingDoctorPicker.vue'

const props = withDefaults(defineProps<{
    form: BookingForm
    query?: BookingQuery
}>(), {
    query: () => ({})
})

const { t, locale, te } = useI18n()
const { hostname } = useRequestHost()

const values = reactive<Record<string, string>>({})
const uploadIds = reactive<Record<string, string>>({})
const fileNames = reactive<Record<string, string>>({})
const pendingFiles = reactive<Record<string, File | undefined>>({})
const touched = reactive<Record<string, boolean>>({})
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const submitting = ref(false)
const submitted = ref(false)
const submissionId = ref('')
const manageUrl = ref('')
const selectedStart = ref<string | null>(props.query.start ?? null)
const durationMinutes = ref(resolveDuration(props.query.duration, props.form.allowedDurations))
// ?practitioner= preselects a doctor at this clinic. Anyone else falls back to "any doctor".
const practitionerId = ref<string | null>(props.form.practitioners.some(practitioner =>
    practitioner.id === props.query.practitioner)
    ? props.query.practitioner ?? null
    : null)
const spokenLanguages = ref<Locale[]>([])
const clinicKey = computed(() => bookingClinicKey(props.form))
const stepIndex = ref(0)

const formSteps = computed(() => {
    const keys: string[] = []
    for (const field of props.form.fields) {
        if (!keys.includes(field.stepKey)) {
            keys.push(field.stepKey)
        }
    }
    return keys.map(key => ({
        key,
        label: te(`bookingPage.steps.${key}`) ? t(`bookingPage.steps.${key}`) : key
    }))
})

const currentStepKey = computed(() => formSteps.value[stepIndex.value]?.key ?? '')
const visibleFields = computed(() =>
    props.form.fields.filter(field => field.stepKey === currentStepKey.value))
const isLastStep = computed(() => stepIndex.value >= formSteps.value.length - 1)
const showSlot = computed(() => {
    if (formSteps.value.some(step => step.key === 'visit')) {
        return currentStepKey.value === 'visit'
    }
    return isLastStep.value
})

const autofillEnabled = computed(() => isBookingAutofillHost(hostname))

for (const field of props.form.fields) {
    if (field.type !== BookingFormFieldType.File) {
        values[field.id] = ''
    }
}

const formSnapshot = computed(() => ({
    values: { ...values },
    uploadIds: { ...uploadIds },
    fileNames: { ...fileNames },
    selectedStart: selectedStart.value
}))

const { makeNonDirty, isDirty } = useUnsavedChanges({
    mode: 'create',
    data: { source: formSnapshot }
})

watch(isDirty, () => {
    // registry handles leave/beforeunload; keep for template consumers if needed
})

const resumedDraft = takeBookingDraft(props.form.id, props.form.version)
if (resumedDraft !== null) {
    for (const field of props.form.fields) {
        if (field.type === BookingFormFieldType.File) {
            continue
        }
        const saved = resumedDraft.values[field.id]
        if (typeof saved === 'string') {
            values[field.id] = saved
        }
    }
    selectedStart.value = resumedDraft.startsAt
    practitionerId.value = resumedDraft.practitionerId
    spokenLanguages.value = resumedDraft.spokenLanguages as Locale[]
    const lastStep = Math.max(formSteps.value.length - 1, 0)
    stepIndex.value = Math.min(Math.max(resumedDraft.stepIndex, 0), lastStep)
    for (const [id, uploadId] of Object.entries(resumedDraft.uploadIds)) {
        uploadIds[id] = uploadId
    }
    for (const [id, name] of Object.entries(resumedDraft.fileNames)) {
        fileNames[id] = name
    }
    for (const [id, file] of Object.entries(resumedDraft.files)) {
        pendingFiles[id] = file
    }
}

const AUTOFILL_DEBOUNCE_MS = 400
let autofillTimer: ReturnType<typeof setTimeout> | undefined
let autofillReady = false

function scalarDraft(): Record<string, string> {
    const scalar: Record<string, string> = {}
    for (const field of props.form.fields) {
        if (field.type === BookingFormFieldType.File) {
            continue
        }
        scalar[field.id] = fieldText(values[field.id])
    }
    return scalar
}

function persistAutofill(): void {
    if (!autofillEnabled.value || submitted.value) {
        return
    }
    const scalar = scalarDraft()
    const hasText = Object.values(scalar).some(value => fieldText(value) !== '')
      || selectedStart.value !== null
    if (!hasText) {
        clearBookingAutofill(props.form.id, hostname)
        return
    }
    writeBookingAutofill(
        props.form.id,
        props.form.version,
        scalar,
        hostname,
        selectedStart.value
    )
}

function scheduleAutofill(): void {
    if (!autofillReady || !autofillEnabled.value || submitted.value) {
        return
    }
    if (autofillTimer !== undefined) {
        clearTimeout(autofillTimer)
    }
    autofillTimer = setTimeout(() => {
        autofillTimer = undefined
        persistAutofill()
    }, AUTOFILL_DEBOUNCE_MS)
}

function flushAutofill(): void {
    if (!autofillReady) {
        return
    }
    if (autofillTimer !== undefined) {
        clearTimeout(autofillTimer)
        autofillTimer = undefined
    }
    persistAutofill()
}

watch(values, scheduleAutofill, { deep: true })
watch(selectedStart, scheduleAutofill)

function rememberCurrentDraft(): void {
    if (submitted.value) {
        clearBookingDraftMemory()
        return
    }
    const files: Record<string, File> = {}
    for (const [id, file] of Object.entries(pendingFiles)) {
        if (file !== undefined) {
            files[id] = file
        }
    }
    rememberBookingDraft({
        formId: props.form.id,
        formVersion: props.form.version,
        values: { ...values },
        startsAt: selectedStart.value,
        practitionerId: practitionerId.value,
        spokenLanguages: [...spokenLanguages.value],
        stepIndex: stepIndex.value,
        uploadIds: { ...uploadIds },
        fileNames: { ...fileNames },
        files
    })
}

onMounted(() => {
    if (!autofillEnabled.value) {
        return
    }
    if (resumedDraft !== null) {
        autofillReady = true
        window.addEventListener('pagehide', flushAutofill)
        return
    }
    const draft = readBookingAutofill(props.form.id, hostname)
    if (draft !== null && draft.formVersion === props.form.version) {
        for (const field of props.form.fields) {
            if (field.type === BookingFormFieldType.File) {
                continue
            }
            const saved = draft.values[field.id]
            if (typeof saved === 'string' && saved !== '') {
                values[field.id] = saved
            }
        }
        if (draft.startsAt !== null) {
            selectedStart.value = draft.startsAt
        }
    }
    autofillReady = true
    window.addEventListener('pagehide', flushAutofill)
})

onBeforeUnmount(() => {
    window.removeEventListener('pagehide', flushAutofill)
    flushAutofill()
    rememberCurrentDraft()
})

function fieldLabel(field: BookingFormField): string {
    if (field.label) {
        return field.label
    }
    return te(field.labelKey) ? t(field.labelKey) : field.id
}

function filePrompt(field: BookingFormField): string {
    if (field.id === 'selfie') {
        return t('bookingPage.choosePhoto')
    }
    return t('bookingPage.chooseFile')
}

function fieldPlaceholder(field: BookingFormField): string {
    if (!field.placeholderKey) {
        return ''
    }
    return te(field.placeholderKey) ? t(field.placeholderKey) : ''
}

function isTextLike(type: BookingFormFieldType): boolean {
    return type === BookingFormFieldType.Email
      || type === BookingFormFieldType.Phone
      || type === BookingFormFieldType.Number
      || type === BookingFormFieldType.Text
}

function inputType(type: BookingFormFieldType): string {
    if (type === BookingFormFieldType.Email) {
        return 'email'
    }
    if (type === BookingFormFieldType.Phone) {
        return 'tel'
    }
    if (type === BookingFormFieldType.Number) {
        return 'number'
    }
    return 'text'
}

function autocompleteFor(field: BookingFormField): string {
    if (field.id === 'email' || field.type === BookingFormFieldType.Email) {
        return 'email'
    }
    if (field.id === 'phone' || field.type === BookingFormFieldType.Phone) {
        return 'tel'
    }
    if (field.id === 'fullName') {
        return 'name'
    }
    return 'off'
}

function onNumberInput(fieldId: string, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) {
        return
    }
    values[fieldId] = target.value
}

function touch(fieldId: string) {
    touched[fieldId] = true
    validateField(fieldId)
}

/** Age is kept as text. A number is accepted so an older value does not crash validation. */
function fieldText(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim()
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value)
    }
    return ''
}

function validateField(fieldId: string): boolean {
    const field = props.form.fields.find(item => item.id === fieldId)
    if (field === undefined) {
        return true
    }

    if (field.type === BookingFormFieldType.File) {
        const hasFile = Boolean(uploadIds[field.id] || pendingFiles[field.id])
        if (field.required && !hasFile) {
            fieldErrors[field.id] = t('bookingPage.errors.required')
            return false
        }
        fieldErrors[field.id] = ''
        return true
    }

    const raw = fieldText(values[field.id])
    if (raw === '') {
        if (field.required) {
            fieldErrors[field.id] = t('bookingPage.errors.required')
            return false
        }
        fieldErrors[field.id] = ''
        return true
    }

    if (field.type === BookingFormFieldType.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        fieldErrors[field.id] = t('bookingPage.errors.email')
        return false
    }
    if (field.type === BookingFormFieldType.Phone && raw.replace(/\D/g, '').length < 8) {
        fieldErrors[field.id] = t('bookingPage.errors.phone')
        return false
    }
    if (field.type === BookingFormFieldType.Number) {
        const number = Number(raw)
        const belowMin = field.min !== null && field.min !== undefined && number < field.min
        const aboveMax = field.max !== null && field.max !== undefined && number > field.max
        if (!Number.isFinite(number) || belowMin || aboveMax) {
            fieldErrors[field.id] = t('bookingPage.errors.number')
            return false
        }
    }

    fieldErrors[field.id] = ''
    return true
}

function validateLeaving(stepKey: string): boolean {
    let valid = true
    for (const field of props.form.fields) {
        if (field.stepKey !== stepKey) {
            continue
        }
        touched[field.id] = true
        if (!validateField(field.id)) {
            valid = false
        }
    }
    formError.value = valid ? '' : t('bookingPage.errors.form')
    return valid
}

function visibleError(fieldId: string): string | undefined {
    if (!touched[fieldId]) {
        return undefined
    }
    const message = fieldErrors[fieldId]
    return message === undefined || message === '' ? undefined : message
}

function onFileChange(field: BookingFormField, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    touched[field.id] = true
    uploadIds[field.id] = ''
    if (file === undefined) {
        pendingFiles[field.id] = undefined
        fileNames[field.id] = ''
        validateField(field.id)
        return
    }
    if (field.maxBytes !== null && field.maxBytes !== undefined && file.size > field.maxBytes) {
        fieldErrors[field.id] = t('bookingPage.errors.fileTooLarge')
        pendingFiles[field.id] = undefined
        fileNames[field.id] = ''
        input.value = ''
        return
    }
    pendingFiles[field.id] = file
    fileNames[field.id] = file.name
    validateField(field.id)
}

/** Undefined when every chosen file is uploaded. */
async function uploadPendingFiles(): Promise<BookingRefusal | undefined> {
    for (const field of props.form.fields) {
        if (field.type !== BookingFormFieldType.File) {
            continue
        }
        const file = pendingFiles[field.id]
        if (file === undefined) {
            continue
        }
        const signed = await requestBookingUploadUrl({
            clinicSiteId: clinicKey.value,
            formDefinitionId: props.form.id,
            fieldId: field.id,
            contentType: file.type || 'application/octet-stream',
            fileName: file.name,
            byteSize: file.size
        })
        if (isBookingRefusal(signed)) {
            fieldErrors[field.id] = t('bookingPage.errors.uploadFailed')
            return signed
        }
        const ok = await putBookingFile(signed.uploadUrl, file, signed.headers)
        if (!ok) {
            fieldErrors[field.id] = t('bookingPage.errors.uploadFailed')
            return 'failed'
        }
        uploadIds[field.id] = signed.uploadId
        pendingFiles[field.id] = undefined
    }
    return undefined
}

function refusalMessage(refusal: BookingRefusal, otherwise: string): string {
    if (refusal === 'rateLimited') {
        return t('bookingPage.errors.tooManyRequests')
    }
    if (refusal === 'openRequestLimit') {
        return t('bookingPage.errors.openRequestLimit')
    }
    return otherwise
}

async function onSubmit() {
    formError.value = ''
    let valid = true
    for (const field of props.form.fields) {
        touched[field.id] = true
        if (!validateField(field.id)) {
            valid = false
        }
    }
    if (selectedStart.value === null || selectedStart.value === '') {
        valid = false
        formError.value = t('bookingPage.errors.slot')
        const visitStep = formSteps.value.findIndex(item => item.key === 'visit')
        if (visitStep >= 0) {
            stepIndex.value = visitStep
        }
    }

    if (!valid) {
        const firstInvalid = props.form.fields.find(field => fieldErrors[field.id])
        const step = formSteps.value.findIndex(item => item.key === firstInvalid?.stepKey)
        if (step >= 0 && formError.value !== t('bookingPage.errors.slot')) {
            stepIndex.value = step
        }
        if (formError.value === '') {
            formError.value = t('bookingPage.errors.form')
        }
        return
    }

    submitting.value = true
    try {
        const uploadRefusal = await uploadPendingFiles()
        if (uploadRefusal !== undefined) {
            formError.value = refusalMessage(uploadRefusal, t('bookingPage.errors.form'))
            return
        }

        const answers = props.form.fields.map(field => {
            if (field.type === BookingFormFieldType.File) {
                return { fieldId: field.id, uploadId: uploadIds[field.id] ?? null, value: null }
            }
            return { fieldId: field.id, value: fieldText(values[field.id]), uploadId: null }
        })

        if (selectedStart.value === null) {
            formError.value = t('bookingPage.errors.slot')
            return
        }

        const result = await submitBookingForm({
            clinicSiteId: clinicKey.value,
            formDefinitionId: props.form.id,
            formVersion: props.form.version,
            locale: String(locale.value),
            answers,
            startsAt: selectedStart.value,
            durationMinutes: durationMinutes.value,
            practitionerId: practitionerId.value,
            spokenLanguages: spokenLanguages.value,
            service: props.query.service
        })

        if (isBookingRefusal(result)) {
            formError.value = refusalMessage(result, t('bookingPage.errors.submitFailed'))
            return
        }

        makeNonDirty()
        submitted.value = true
        submissionId.value = result.id
        manageUrl.value = result.manageToken
            ? `${localizedPath('/book/manage', String(locale.value))}#${result.manageToken}`
            : ''
        if (autofillEnabled.value) {
            clearBookingAutofill(props.form.id, hostname)
        }
    } finally {
        submitting.value = false
    }
}
</script>
