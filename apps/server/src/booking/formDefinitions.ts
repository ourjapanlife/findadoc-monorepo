import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    type BookingForm,
    type BookingFormField
} from '@findadoc/graphql'
import { BOOKING_FIELD_SENSITIVITY, type BookingFieldSensitivity as StoredSensitivity } from './retention.js'

/**
 * Code-defined booking forms keyed by clinic_sites.id.
 * A later CRM replaces this map with a row (or versioned document) without
 * changing the GraphQL BookingForm shape or the submission table.
 *
 * Showcase id matches `SHOWCASE_CLINIC_SITE_ID` in clinicSiteContent.ts.
 */
export const SHOWCASE_BOOKING_CLINIC_SITE_ID = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'

type FormSource = {
    id: string
    version: number
    notifyEmail?: string | null
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

const showcaseFields: BookingFormField[] = [
    field({
        id: 'email',
        type: BookingFormFieldType.Email,
        required: true,
        labelKey: 'bookingPage.fields.email',
        placeholderKey: 'bookingPage.placeholders.email',
        maxLength: 254
    }),
    field({
        id: 'phone',
        type: BookingFormFieldType.Phone,
        required: true,
        labelKey: 'bookingPage.fields.phone',
        placeholderKey: 'bookingPage.placeholders.phone',
        maxLength: 40
    }),
    field({
        id: 'fullName',
        type: BookingFormFieldType.Text,
        required: true,
        labelKey: 'bookingPage.fields.fullName',
        placeholderKey: 'bookingPage.placeholders.fullName',
        maxLength: 120
    }),
    field({
        id: 'age',
        type: BookingFormFieldType.Number,
        required: true,
        labelKey: 'bookingPage.fields.age',
        placeholderKey: 'bookingPage.placeholders.age',
        min: 0,
        max: 120
    }),
    field({
        id: 'reason',
        type: BookingFormFieldType.Textarea,
        required: true,
        labelKey: 'bookingPage.fields.reason',
        placeholderKey: 'bookingPage.placeholders.reason',
        maxLength: 2000,
        sensitivity: BookingFieldSensitivity.Medical
    }),
    field({
        id: 'insuranceDocument',
        type: BookingFormFieldType.File,
        required: true,
        labelKey: 'bookingPage.fields.insuranceDocument',
        accept: 'image/jpeg,image/png,image/webp,application/pdf',
        maxBytes: 8 * 1024 * 1024,
        sensitivity: BookingFieldSensitivity.IdentityDocument
    })
]

const FORMS_BY_CLINIC_SITE_ID: Record<string, FormSource> = {
    [SHOWCASE_BOOKING_CLINIC_SITE_ID]: {
        id: 'showcase-intake-v1',
        version: 1,
        notifyEmail: null,
        fields: showcaseFields
    }
}

export function formSourceForClinicSite(clinicSiteId: string): FormSource | undefined {
    return FORMS_BY_CLINIC_SITE_ID[clinicSiteId]
}

export function assembleBookingForm(input: {
    clinicSiteId: string
    clinicSiteSlug: string
    clinicName: string
    themePrimary: string | null
    notifyEmailFallback: string | null
}): BookingForm | null {
    const source = formSourceForClinicSite(input.clinicSiteId)
    if (source === undefined) {
        return null
    }

    return {
        id: source.id,
        version: source.version,
        clinicSiteId: input.clinicSiteId,
        clinicSiteSlug: input.clinicSiteSlug,
        clinicName: input.clinicName,
        themePrimary: input.themePrimary,
        notifyEmail: source.notifyEmail ?? input.notifyEmailFallback,
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
