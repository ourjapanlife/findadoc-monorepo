import {
    BookingFormFieldType,
    type BookingForm,
    type BookingFormField
} from '@findadoc/graphql'

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

const showcaseFields: BookingFormField[] = [
    {
        id: 'email',
        type: BookingFormFieldType.Email,
        required: true,
        labelKey: 'bookingPage.fields.email',
        label: null,
        placeholderKey: 'bookingPage.placeholders.email',
        accept: null,
        maxLength: 254,
        maxBytes: null,
        min: null,
        max: null,
        options: null
    },
    {
        id: 'phone',
        type: BookingFormFieldType.Phone,
        required: true,
        labelKey: 'bookingPage.fields.phone',
        label: null,
        placeholderKey: 'bookingPage.placeholders.phone',
        accept: null,
        maxLength: 40,
        maxBytes: null,
        min: null,
        max: null,
        options: null
    },
    {
        id: 'fullName',
        type: BookingFormFieldType.Text,
        required: true,
        labelKey: 'bookingPage.fields.fullName',
        label: null,
        placeholderKey: 'bookingPage.placeholders.fullName',
        accept: null,
        maxLength: 120,
        maxBytes: null,
        min: null,
        max: null,
        options: null
    },
    {
        id: 'age',
        type: BookingFormFieldType.Number,
        required: true,
        labelKey: 'bookingPage.fields.age',
        label: null,
        placeholderKey: 'bookingPage.placeholders.age',
        accept: null,
        maxLength: null,
        maxBytes: null,
        min: 0,
        max: 120,
        options: null
    },
    {
        id: 'reason',
        type: BookingFormFieldType.Textarea,
        required: true,
        labelKey: 'bookingPage.fields.reason',
        label: null,
        placeholderKey: 'bookingPage.placeholders.reason',
        accept: null,
        maxLength: 2000,
        maxBytes: null,
        min: null,
        max: null,
        options: null
    },
    {
        id: 'insuranceDocument',
        type: BookingFormFieldType.File,
        required: true,
        labelKey: 'bookingPage.fields.insuranceDocument',
        label: null,
        placeholderKey: null,
        accept: 'image/jpeg,image/png,image/webp,application/pdf',
        maxLength: null,
        maxBytes: 8 * 1024 * 1024,
        min: null,
        max: null,
        options: null
    }
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
    return form.fields.find(field => field.id === fieldId)
}
