<template>
    <div
        data-testid="clinic-booking"
        class="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-10 landscape:px-12"
        :class="{ 'clinic-theme': themeStyle !== undefined }"
        :style="themeStyle"
    >
        <header class="flex flex-col gap-3">
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
        </div>

        <form
            v-else
            novalidate
            class="card flex flex-col gap-5 p-6"
            data-testid="clinic-booking-form"
            @submit.prevent="onSubmit"
        >
            <BookingSlotPicker
                v-model="selectedStart"
                :clinic-site-id="form.clinicSiteId"
            />

            <div
                v-for="field in form.fields"
                :key="field.id"
                class="flex flex-col gap-1.5"
            >
                <label
                    :for="`booking-${field.id}`"
                    class="field-label"
                >
                    {{ fieldLabel(field) }}
                    <span
                        v-if="!field.required"
                        class="ml-1 font-normal text-primary-text-muted"
                    >({{ t('bookingPage.optional') }})</span>
                </label>

                <input
                    v-if="isTextLike(field.type)"
                    :id="`booking-${field.id}`"
                    v-model="values[field.id]"
                    class="field"
                    :type="inputType(field.type)"
                    :required="field.required"
                    :maxlength="field.maxLength ?? undefined"
                    :min="field.min ?? undefined"
                    :max="field.max ?? undefined"
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

                <div
                    v-else-if="field.type === BookingFormFieldType.File"
                    class="flex flex-col gap-2"
                >
                    <input
                        :id="`booking-${field.id}`"
                        type="file"
                        class="field"
                        :accept="field.accept ?? undefined"
                        :required="field.required && !uploadIds[field.id]"
                        :data-testid="`clinic-booking-field-${field.id}`"
                        @change="onFileChange(field, $event)"
                    >
                    <p
                        v-if="fileNames[field.id]"
                        class="text-sm text-primary-text-muted"
                    >
                        {{ fileNames[field.id] }}
                    </p>
                </div>

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

            <div class="flex flex-col gap-3 landscape:flex-row landscape:items-center">
                <button
                    type="submit"
                    class="btn btn-primary"
                    data-testid="clinic-booking-submit"
                    :disabled="submitting"
                >
                    {{ submitting ? t('bookingPage.submitting') : t('bookingPage.submit') }}
                </button>
                <button
                    v-if="autofillEnabled"
                    type="button"
                    class="btn btn-secondary"
                    data-testid="clinic-booking-save-autofill"
                    @click="saveAutofill"
                >
                    {{ t('bookingPage.saveAutofill') }}
                </button>
            </div>
            <p
                v-if="autofillMessage"
                class="text-sm text-primary-text-muted"
                data-testid="clinic-booking-autofill-message"
            >
                {{ autofillMessage }}
            </p>
            <p class="text-sm text-primary-text-muted">
                {{ t('bookingPage.privacyNote') }}
            </p>
        </form>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    BookingFormFieldType,
    type BookingForm,
    type BookingFormField
} from '@findadoc/graphql'
import { useUnsavedChanges } from '~/composables/useUnsavedChanges'
import {
    clearBookingAutofill,
    isBookingAutofillHost,
    readBookingAutofill,
    writeBookingAutofill
} from '~/utils/booking/localhostAutofill'
import {
    putBookingFile,
    requestBookingUploadUrl,
    submitBookingForm
} from '~/utils/booking/formQuery'
import { clinicThemeVars } from '~/utils/clinicTheme'
import { useRequestHost } from '~/composables/useClinicLanding'

const props = defineProps<{
    form: BookingForm
}>()

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
const autofillMessage = ref('')
const selectedStart = ref<string | null>(null)

const themeStyle = clinicThemeVars(props.form.themePrimary)
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

onMounted(() => {
    if (!autofillEnabled.value) {
        return
    }
    const draft = readBookingAutofill(props.form.id, hostname)
    if (draft === null || draft.formVersion !== props.form.version) {
        return
    }
    for (const field of props.form.fields) {
        if (field.type === BookingFormFieldType.File) {
            continue
        }
        const saved = draft.values[field.id]
        if (typeof saved === 'string') {
            values[field.id] = saved
        }
    }
    autofillMessage.value = t('bookingPage.autofillRestored')
})

function fieldLabel(field: BookingFormField): string {
    if (field.label) {
        return field.label
    }
    return te(field.labelKey) ? t(field.labelKey) : field.id
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

function touch(fieldId: string) {
    touched[fieldId] = true
    validateField(fieldId)
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

    const raw = (values[field.id] ?? '').trim()
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
        if (!Number.isFinite(number)) {
            fieldErrors[field.id] = t('bookingPage.errors.number')
            return false
        }
    }

    fieldErrors[field.id] = ''
    return true
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

function saveAutofill() {
    if (!autofillEnabled.value) {
        return
    }
    const scalar: Record<string, string> = {}
    for (const field of props.form.fields) {
        if (field.type === BookingFormFieldType.File) {
            continue
        }
        scalar[field.id] = values[field.id] ?? ''
    }
    writeBookingAutofill(props.form.id, props.form.version, scalar, hostname)
    autofillMessage.value = t('bookingPage.autofillSaved')
}

async function uploadPendingFiles(): Promise<boolean> {
    for (const field of props.form.fields) {
        if (field.type !== BookingFormFieldType.File) {
            continue
        }
        const file = pendingFiles[field.id]
        if (file === undefined) {
            continue
        }
        const signed = await requestBookingUploadUrl({
            clinicSiteId: props.form.clinicSiteId,
            fieldId: field.id,
            contentType: file.type || 'application/octet-stream',
            fileName: file.name,
            byteSize: file.size
        })
        if (signed === null) {
            fieldErrors[field.id] = t('bookingPage.errors.uploadFailed')
            return false
        }
        const ok = await putBookingFile(signed.uploadUrl, file, signed.headers)
        if (!ok) {
            fieldErrors[field.id] = t('bookingPage.errors.uploadFailed')
            return false
        }
        uploadIds[field.id] = signed.uploadId
        pendingFiles[field.id] = undefined
    }
    return true
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
    if (!valid) {
        formError.value = t('bookingPage.errors.fix')
        return
    }

    submitting.value = true
    try {
        const uploaded = await uploadPendingFiles()
        if (!uploaded) {
            formError.value = t('bookingPage.errors.form')
            return
        }

        const answers = props.form.fields.map(field => {
            if (field.type === BookingFormFieldType.File) {
                return { fieldId: field.id, uploadId: uploadIds[field.id] ?? null, value: null }
            }
            return { fieldId: field.id, value: (values[field.id] ?? '').trim(), uploadId: null }
        })

        const result = await submitBookingForm({
            clinicSiteId: props.form.clinicSiteId,
            formDefinitionId: props.form.id,
            formVersion: props.form.version,
            locale: String(locale.value),
            answers,
            startsAt: selectedStart.value
        })

        if (result === null) {
            formError.value = t('bookingPage.errors.submitFailed')
            return
        }

        makeNonDirty()
        submitted.value = true
        submissionId.value = result.id
        if (autofillEnabled.value) {
            clearBookingAutofill(props.form.id, hostname)
        }
    } finally {
        submitting.value = false
    }
}
</script>
