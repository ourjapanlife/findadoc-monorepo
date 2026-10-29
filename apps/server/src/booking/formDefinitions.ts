import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    type BookingForm,
    type BookingFormField
} from '@findadoc/graphql'
import { BOOKING_UPLOAD_MAX_BYTES } from './limits.js'
import { BOOKING_FIELD_SENSITIVITY, type BookingFieldSensitivity as StoredSensitivity } from './retention.js'
import { DEFAULT_ALLOWED_DURATIONS } from './schedule.js'

/**
 * Find a Doc owns the intake fields. Each entry in FORMS_BY_ID is one form type.
 * A clinic offers one or more of them through booking_settings.form_definition_ids
 * (the first is its default). `?form=` on the Book URL picks one the clinic offers.
 *
 * The definitions are code today. A later clinic-authored form only has to
 * return the same FormSource shape from formSourceById.
 */

export const DEFAULT_BOOKING_FORM_ID = 'findadoc-intake-v1'
export const SHOWCASE_BOOKING_FORM_ID = 'showcase-intake-v1'

export type FormSource = {
    id: string
    version: number
    /** Site i18n key for the form type name, shown when a clinic picks its forms. */
    labelKey: string
    fields: BookingFormField[]
}

function field(
    partial: Omit<BookingFormField, 'sensitivity' | 'label' | 'placeholderKey' | 'accept' | 'maxLength' | 'maxBytes' | 'min' | 'max' | 'options'>
    & Partial<BookingFormField>
    & { sensitivity?: BookingFormField['sensitivity'] }
): BookingFormField {
    return {
        label: null,
        placeholderKey: null,
        accept: null,
        maxLength: null,
        maxBytes: null,
        min: null,
        max: null,
        options: null,
        sensitivity: BookingFieldSensitivity.Standard,
        ...partial
    }
}

const contactAndVisitFields: BookingFormField[] = [
    field({
        id: 'email',
        stepKey: 'contact',
        type: BookingFormFieldType.Email,
        required: true,
        labelKey: 'bookingPage.fields.email',
        placeholderKey: 'bookingPage.placeholders.email',
        maxLength: 254
    }),
    field({
        id: 'phone',
        stepKey: 'contact',
        type: BookingFormFieldType.Phone,
        required: true,
        labelKey: 'bookingPage.fields.phone',
        placeholderKey: 'bookingPage.placeholders.phone',
        maxLength: 40
    }),
    field({
        id: 'fullName',
        stepKey: 'contact',
        type: BookingFormFieldType.Text,
        required: true,
        labelKey: 'bookingPage.fields.fullName',
        placeholderKey: 'bookingPage.placeholders.fullName',
        maxLength: 120
    }),
    field({
        id: 'reason',
        stepKey: 'visit',
        type: BookingFormFieldType.Textarea,
        required: true,
        labelKey: 'bookingPage.fields.reason',
        placeholderKey: 'bookingPage.placeholders.reason',
        maxLength: 2000,
        sensitivity: BookingFieldSensitivity.Medical
    })
]

const showcaseFields: BookingFormField[] = [
    ...contactAndVisitFields.slice(0, 3),
    field({
        id: 'age',
        stepKey: 'contact',
        type: BookingFormFieldType.Number,
        required: true,
        labelKey: 'bookingPage.fields.age',
        placeholderKey: 'bookingPage.placeholders.age',
        min: 0,
        max: 120
    }),
    contactAndVisitFields[3]!,
    field({
        id: 'insuranceDocument',
        stepKey: 'documents',
        type: BookingFormFieldType.File,
        required: true,
        labelKey: 'bookingPage.fields.insuranceDocument',
        accept: 'image/jpeg,image/png,image/webp,application/pdf',
        maxBytes: BOOKING_UPLOAD_MAX_BYTES,
        sensitivity: BookingFieldSensitivity.IdentityDocument
    }),
    field({
        id: 'selfie',
        stepKey: 'documents',
        type: BookingFormFieldType.File,
        required: true,
        labelKey: 'bookingPage.fields.selfie',
        accept: 'image/jpeg,image/png,image/webp',
        maxBytes: BOOKING_UPLOAD_MAX_BYTES,
        sensitivity: BookingFieldSensitivity.IdentityDocument
    })
]

const FORMS_BY_ID: Record<string, FormSource> = {
    [DEFAULT_BOOKING_FORM_ID]: {
        id: DEFAULT_BOOKING_FORM_ID,
        version: 1,
        labelKey: 'bookingForms.standardIntake',
        fields: contactAndVisitFields
    },
    [SHOWCASE_BOOKING_FORM_ID]: {
        id: SHOWCASE_BOOKING_FORM_ID,
        version: 1,
        labelKey: 'bookingForms.onlineConsultIntake',
        fields: showcaseFields
    }
}

export function formSourceById(formId: string): FormSource | undefined {
    return FORMS_BY_ID[formId]
}

/** Every form type a clinic may offer, in registry order. */
export function listFormSources(): FormSource[] {
    return Object.values(FORMS_BY_ID)
}

export function resolveFormSource(formDefinitionId: string): FormSource {
    return formSourceById(formDefinitionId) ?? FORMS_BY_ID[DEFAULT_BOOKING_FORM_ID]!
}

/** Known ids only, without repeats, in the clinic's order. Falls back to the default form. */
export function parseFormDefinitionIds(value: unknown): string[] {
    const ids: string[] = []
    if (Array.isArray(value)) {
        for (const item of value) {
            if (typeof item === 'string' && formSourceById(item) !== undefined && !ids.includes(item)) {
                ids.push(item)
            }
        }
    }
    return ids.length > 0 ? ids : [DEFAULT_BOOKING_FORM_ID]
}

/** `?form=` may pick any form the clinic offers. Anything else gets the clinic default. */
export function chooseFormDefinitionId(
    offeredFormIds: readonly string[],
    requestedFormId?: string | null
): string {
    const offered = parseFormDefinitionIds(offeredFormIds)
    if (requestedFormId !== null && requestedFormId !== undefined && offered.includes(requestedFormId)) {
        return requestedFormId
    }
    return offered[0]!
}

/** True when the clinic offers this exact form id. Submit and upload require it. */
export function isOfferedFormId(offeredFormIds: readonly string[], formId: string): boolean {
    return parseFormDefinitionIds(offeredFormIds).includes(formId)
}

/** A form without the clinic's doctors and languages, which come from the database. */
export type AssembledBookingForm = Omit<BookingForm, 'practitioners' | 'languages'>

export function assembleBookingForm(input: {
    formDefinitionId?: string | null
    facilityId?: string | null
    clinicSiteId?: string | null
    clinicSiteSlug?: string | null
    clinicName: string
    themePrimary?: string | null
    allowedDurations?: readonly number[]
}): AssembledBookingForm {
    const source = resolveFormSource(input.formDefinitionId ?? DEFAULT_BOOKING_FORM_ID)

    return {
        id: source.id,
        version: source.version,
        facilityId: input.facilityId ?? null,
        clinicSiteId: input.clinicSiteId ?? null,
        clinicSiteSlug: input.clinicSiteSlug ?? null,
        clinicName: input.clinicName,
        themePrimary: input.themePrimary ?? null,
        allowedDurations: [...(input.allowedDurations ?? DEFAULT_ALLOWED_DURATIONS)],
        fields: source.fields
    }
}

export function fieldById(form: Pick<BookingForm, 'fields'>, fieldId: string): BookingFormField | undefined {
    return form.fields.find(item => item.id === fieldId)
}

export function storedSensitivity(bookingField: BookingFormField): StoredSensitivity {
    if (bookingField.sensitivity === BookingFieldSensitivity.IdentityDocument) {
        return BOOKING_FIELD_SENSITIVITY.IDENTITY_DOCUMENT
    }
    if (bookingField.sensitivity === BookingFieldSensitivity.Medical) {
        return BOOKING_FIELD_SENSITIVITY.MEDICAL
    }
    return BOOKING_FIELD_SENSITIVITY.STANDARD
}
