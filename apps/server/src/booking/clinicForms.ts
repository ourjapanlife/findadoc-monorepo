import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    type BookingFormField,
    type BookingLocalizedText,
    type BookingLocalizedTextInput,
    type ClinicBookingFormFieldInput
} from '@findadoc/graphql'
import { SITE_LOCALES, isSiteLocale } from './emailCopy.js'
import { BOOKING_UPLOAD_MAX_BYTES } from './limits.js'

/**
 * Clinic-written intake questions (#166). A clinic form is Find a Doc's email,
 * phone, and name questions, then these. They are stored as
 * booking_form_versions.fields and read back as BookingFormField, so the Book
 * page, submit validation, and storage treat them like any other field.
 */

export const CLINIC_FORM_ID_PREFIX = 'clinic-'
/** English is required on every clinic label. Another locale without one shows English. */
export const CLINIC_FORM_REQUIRED_LOCALE = 'en-US'
export const CLINIC_FORM_STEP_KEYS = ['contact', 'visit', 'documents'] as const
export const MAX_CLINIC_FORM_FIELDS = 30
export const MAX_CLINIC_FORM_NAME_LENGTH = 80
const MAX_LABEL_LENGTH = 200
const MIN_SELECT_OPTIONS = 2
const MAX_SELECT_OPTIONS = 20
/** Find a Doc asks these on every clinic form, and the request emails read them. */
const RESERVED_FIELD_IDS = new Set(['email', 'phone', 'fullName'])
const FIELD_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/
const OPTION_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/
const CLINIC_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

/** Longest answer, by type. TEXT and TEXTAREA may set a lower one. */
const MAX_LENGTH_BY_TYPE: Partial<Record<BookingFormFieldType, number>> = {
    [BookingFormFieldType.Email]: 254,
    [BookingFormFieldType.Phone]: 40,
    [BookingFormFieldType.Text]: 200,
    [BookingFormFieldType.Textarea]: 2000
}

type StoredLabels = Record<string, string>

export type StoredClinicOption = {
    value: string
    labels: StoredLabels
}

/** One question as it is stored. Labels are keyed by site locale. */
export type StoredClinicField = {
    id: string
    stepKey: string
    type: BookingFormFieldType
    required: boolean
    sensitivity: BookingFieldSensitivity
    labels: StoredLabels
    maxLength: number | null
    min: number | null
    max: number | null
    options: StoredClinicOption[] | null
}

export type ClinicFieldsResult =
    | { fields: StoredClinicField[], invalidField?: undefined }
    | { fields?: undefined, invalidField: string }

export function isClinicFormId(formId: string): boolean {
    return formId.startsWith(CLINIC_FORM_ID_PREFIX)
}

export function parseClinicFormName(value: string): string | undefined {
    const name = value.trim()
    return name === '' || name.length > MAX_CLINIC_FORM_NAME_LENGTH ? undefined : name
}

/** Trimmed labels in site-locale order. Undefined when English is missing or a locale is unknown or repeated. */
function parseLabels(input: readonly BookingLocalizedTextInput[]): StoredLabels | undefined {
    const byLocale = new Map<string, string>()
    for (const label of input) {
        if (!isSiteLocale(label.locale) || byLocale.has(label.locale)) {
            return undefined
        }
        const text = label.text.trim()
        if (text.length > MAX_LABEL_LENGTH) {
            return undefined
        }
        if (text !== '') {
            byLocale.set(label.locale, text)
        }
    }
    if (!byLocale.has(CLINIC_FORM_REQUIRED_LOCALE)) {
        return undefined
    }
    const labels: StoredLabels = {}
    for (const locale of SITE_LOCALES) {
        const text = byLocale.get(locale)
        if (text !== undefined) {
            labels[locale] = text
        }
    }
    return labels
}

function isStepKey(value: string): boolean {
    return CLINIC_FORM_STEP_KEYS.some(stepKey => stepKey === value)
}

function defaultSensitivity(type: BookingFormFieldType): BookingFieldSensitivity {
    return type === BookingFormFieldType.File
        ? BookingFieldSensitivity.IdentityDocument
        : BookingFieldSensitivity.Standard
}

function parseMaxLength(input: ClinicBookingFormFieldInput): number | null | undefined {
    const limit = MAX_LENGTH_BY_TYPE[input.type]
    const asked = input.maxLength ?? null
    if (asked === null) {
        return limit ?? null
    }
    const settable = input.type === BookingFormFieldType.Text || input.type === BookingFormFieldType.Textarea
    if (!settable || limit === undefined || !Number.isInteger(asked) || asked < 1 || asked > limit) {
        return undefined
    }
    return asked
}

function parseOptions(input: ClinicBookingFormFieldInput): StoredClinicOption[] | null | undefined {
    const options = input.options ?? null
    if (input.type !== BookingFormFieldType.Select) {
        return options === null || options.length === 0 ? null : undefined
    }
    if (options === null || options.length < MIN_SELECT_OPTIONS || options.length > MAX_SELECT_OPTIONS) {
        return undefined
    }
    const stored: StoredClinicOption[] = []
    for (const option of options) {
        const value = option.value.trim()
        const labels = parseLabels(option.labels)
        if (!OPTION_VALUE_PATTERN.test(value) || stored.some(item => item.value === value) || labels === undefined) {
            return undefined
        }
        stored.push({ value, labels })
    }
    return stored
}

function parseNumberBound(
    input: ClinicBookingFormFieldInput,
    bound: number | null | undefined
): number | null | undefined {
    const value = bound ?? null
    if (value === null) {
        return null
    }
    return input.type === BookingFormFieldType.Number && Number.isFinite(value) ? value : undefined
}

/**
 * Checks a clinic's questions and returns them as they are stored. invalidField
 * names the first problem, such as `fields.2.labels`.
 */
export function parseClinicFormFields(input: readonly ClinicBookingFormFieldInput[]): ClinicFieldsResult {
    if (input.length === 0 || input.length > MAX_CLINIC_FORM_FIELDS) {
        return { invalidField: 'fields' }
    }
    const fields: StoredClinicField[] = []
    for (const [index, item] of input.entries()) {
        const path = `fields.${index}`
        const id = item.id.trim()
        if (!FIELD_ID_PATTERN.test(id) || RESERVED_FIELD_IDS.has(id) || fields.some(field => field.id === id)) {
            return { invalidField: `${path}.id` }
        }
        if (!isStepKey(item.stepKey)) {
            return { invalidField: `${path}.stepKey` }
        }
        const labels = parseLabels(item.labels)
        if (labels === undefined) {
            return { invalidField: `${path}.labels` }
        }
        const maxLength = parseMaxLength(item)
        if (maxLength === undefined) {
            return { invalidField: `${path}.maxLength` }
        }
        const min = parseNumberBound(item, item.min)
        const max = parseNumberBound(item, item.max)
        if (min === undefined || max === undefined || (min !== null && max !== null && min > max)) {
            return { invalidField: `${path}.min` }
        }
        const options = parseOptions(item)
        if (options === undefined) {
            return { invalidField: `${path}.options` }
        }
        fields.push({
            id,
            stepKey: item.stepKey,
            type: item.type,
            required: item.required,
            sensitivity: item.sensitivity ?? defaultSensitivity(item.type),
            labels,
            maxLength,
            min,
            max,
            options
        })
    }
    return { fields }
}

function labelList(labels: StoredLabels): BookingLocalizedText[] {
    return SITE_LOCALES
        .filter(locale => labels[locale] !== undefined)
        .map(locale => ({ locale, text: labels[locale]! }))
}

/** A stored question as the Book page and staff read it. */
export function clinicFieldToFormField(stored: StoredClinicField): BookingFormField {
    const isFile = stored.type === BookingFormFieldType.File
    return {
        id: stored.id,
        stepKey: stored.stepKey,
        type: stored.type,
        required: stored.required,
        labelKey: '',
        label: stored.labels[CLINIC_FORM_REQUIRED_LOCALE] ?? stored.id,
        labels: labelList(stored.labels),
        placeholderKey: null,
        accept: isFile ? CLINIC_UPLOAD_ACCEPT : null,
        maxLength: stored.maxLength,
        maxBytes: isFile ? BOOKING_UPLOAD_MAX_BYTES : null,
        min: stored.min,
        max: stored.max,
        sensitivity: stored.sensitivity,
        options: stored.options === null
            ? null
            : stored.options.map(option => ({
                value: option.value,
                labelKey: '',
                label: option.labels[CLINIC_FORM_REQUIRED_LOCALE] ?? option.value,
                labels: labelList(option.labels)
            }))
    }
}

/** Stored fields from a jsonb column, which the driver may return as text. */
export function storedClinicFields(value: unknown): StoredClinicField[] {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed as StoredClinicField[] : []
}

function orderedLabels(labels: StoredLabels): StoredLabels {
    return Object.fromEntries(labelList(labels).map(label => [label.locale, label.text]))
}

// jsonb does not keep key order, so both sides are rebuilt in one order before comparing.
function canonicalField(field: StoredClinicField): StoredClinicField {
    return {
        id: field.id,
        stepKey: field.stepKey,
        type: field.type,
        required: field.required,
        sensitivity: field.sensitivity,
        labels: orderedLabels(field.labels),
        maxLength: field.maxLength,
        min: field.min,
        max: field.max,
        options: field.options === null
            ? null
            : field.options.map(option => ({ value: option.value, labels: orderedLabels(option.labels) }))
    }
}

/** True when two saves ask the same questions, so the version stays. */
export function sameClinicFields(a: readonly StoredClinicField[], b: readonly StoredClinicField[]): boolean {
    return JSON.stringify(a.map(canonicalField)) === JSON.stringify(b.map(canonicalField))
}
