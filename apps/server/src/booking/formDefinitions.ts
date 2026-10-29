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
 * Find a Doc owns the intake fields. A clinic may choose a named variant
 * (showcase online consult) through booking_settings.form_definition_id.
 * `?form=` on the Book URL may select a known id, not an arbitrary document.
 */

export const DEFAULT_BOOKING_FORM_ID = 'findadoc-intake-v1'
export const SHOWCASE_BOOKING_FORM_ID = 'showcase-intake-v1'
export const SHOWCASE_BOOKING_CLINIC_SITE_ID = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'

type FormSource = {
    id: string
    version: number
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
        fields: contactAndVisitFields
    },
    [SHOWCASE_BOOKING_FORM_ID]: {
        id: SHOWCASE_BOOKING_FORM_ID,
        version: 1,
        fields: showcaseFields
    }
}

export function formSourceById(formId: string): FormSource | undefined {
    return FORMS_BY_ID[formId]
}

export function formSourceForClinicSite(clinicSiteId: string): FormSource | undefined {
    if (clinicSiteId === SHOWCASE_BOOKING_CLINIC_SITE_ID) {
        return FORMS_BY_ID[SHOWCASE_BOOKING_FORM_ID]
    }
    return FORMS_BY_ID[DEFAULT_BOOKING_FORM_ID]
}

export function resolveFormSource(formDefinitionId: string): FormSource {
    return formSourceById(formDefinitionId) ?? FORMS_BY_ID[DEFAULT_BOOKING_FORM_ID]!
}

/** Clinic settings win. `?form=` may only pick a known id the clinic already uses, or the default. */
export function chooseFormDefinitionId(
    clinicFormId: string,
    requestedFormId?: string | null
): string {
    if (requestedFormId === null || requestedFormId === undefined || requestedFormId === '') {
        return clinicFormId
    }
    if (requestedFormId === clinicFormId || requestedFormId === DEFAULT_BOOKING_FORM_ID) {
        return requestedFormId
    }
    return clinicFormId
}

export function assembleBookingForm(input: {
    formDefinitionId?: string | null
    facilityId?: string | null
    clinicSiteId?: string | null
    clinicSiteSlug?: string | null
    clinicName: string
    themePrimary?: string | null
    allowedDurations?: readonly number[]
}): BookingForm {
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

export function fieldById(form: BookingForm, fieldId: string): BookingFormField | undefined {
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
