import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    type BookingForm,
    type BookingFormField
} from '@findadoc/graphql'
import { db } from '../kyselyClient.js'
import { clinicFieldToFormField, isClinicFormId, storedClinicFields } from './clinicForms.js'
import { BOOKING_UPLOAD_MAX_BYTES } from './limits.js'
import { BOOKING_FIELD_SENSITIVITY, type BookingFieldSensitivity as StoredSensitivity } from './retention.js'
import { DEFAULT_ALLOWED_DURATIONS, DEFAULT_APPOINTMENT_DURATION_MINUTES, resolveDefaultDuration } from './schedule.js'

/**
 * Each entry in FORMS_BY_ID is one Find a Doc form type. A clinic may also write
 * its own forms (#166): rows in booking_form_definitions and booking_form_versions,
 * with ids that start with `clinic-` (clinicForms.ts). formSourceById returns both
 * as one FormSource shape, so the renderer, validation, and storage do not change.
 *
 * A clinic offers one or more forms through booking_settings.form_definition_ids
 * (the first is its default). `?form=` on the Book URL picks one the clinic offers.
 */

export const DEFAULT_BOOKING_FORM_ID = 'findadoc-intake-v1'
export const SHOWCASE_BOOKING_FORM_ID = 'showcase-intake-v1'

export type FormSource = {
    id: string
    version: number
    /** Site i18n key for the form type name, shown when a clinic picks its forms. Empty on a clinic form. */
    labelKey: string
    /** The clinic's name for its own form. Null on a Find a Doc form. */
    name: string | null
    /** The clinic that wrote the form. Null on a Find a Doc form. */
    facilityId: string | null
    fields: BookingFormField[]
}

function field(
    partial: Omit<BookingFormField, 'sensitivity' | 'label' | 'labels' | 'placeholderKey' | 'accept' | 'maxLength' | 'maxBytes' | 'min' | 'max' | 'options'>
    & Partial<BookingFormField>
    & { sensitivity?: BookingFormField['sensitivity'] }
): BookingFormField {
    return {
        label: null,
        labels: [],
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

/** Proof of insurance a patient may send. `mynaInsurance` is a My Number card registered as insurance. */
export const INSURANCE_TYPES = ['insuranceCard', 'eligibilityCertificate', 'mynaInsurance'] as const

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
    // Which proof of insurance the patient has. The Book page shows a guide for each;
    // a My Number insurance card is shown as a マイナポータル screenshot, never the card.
    field({
        id: 'insuranceType',
        stepKey: 'documents',
        type: BookingFormFieldType.Select,
        required: true,
        labelKey: 'bookingPage.fields.insuranceType',
        options: INSURANCE_TYPES.map(value => ({
            value,
            labelKey: `bookingPage.options.insuranceType.${value}`,
            label: null,
            labels: []
        }))
    }),
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
        name: null,
        facilityId: null,
        fields: contactAndVisitFields
    },
    [SHOWCASE_BOOKING_FORM_ID]: {
        id: SHOWCASE_BOOKING_FORM_ID,
        // 2 asks which proof of insurance the patient has.
        version: 2,
        labelKey: 'bookingForms.onlineConsultIntake',
        name: null,
        facilityId: null,
        fields: showcaseFields
    }
}

/** Find a Doc asks these first on every clinic form. The request emails read them. */
const CLINIC_FORM_CONTACT_FIELDS = contactAndVisitFields.slice(0, 3)

/** The form to show when an offered form id no longer resolves. */
export const DEFAULT_FORM_SOURCE: FormSource = FORMS_BY_ID[DEFAULT_BOOKING_FORM_ID]!

/**
 * A Find a Doc form, or a clinic form at `version` (its current version when omitted).
 * A Find a Doc form has one definition in code, so `version` does not change it.
 */
export async function formSourceById(formId: string, version?: number): Promise<FormSource | undefined> {
    if (!isClinicFormId(formId)) {
        return FORMS_BY_ID[formId]
    }
    const row = await db.selectFrom('booking_form_definitions as form')
        .innerJoin('booking_form_versions as saved', 'saved.form_definition_id', 'form.id')
        .select(['form.id', 'form.facility_id', 'form.name', 'saved.version', 'saved.fields'])
        .where('form.id', '=', formId)
        .where(eb => version === undefined
            ? eb('saved.version', '=', eb.ref('form.current_version'))
            : eb('saved.version', '=', version))
        .executeTakeFirst()
    if (row === undefined) {
        return undefined
    }
    return {
        id: row.id,
        version: row.version,
        labelKey: '',
        name: row.name,
        facilityId: row.facility_id,
        fields: [...CLINIC_FORM_CONTACT_FIELDS, ...storedClinicFields(row.fields).map(clinicFieldToFormField)]
    }
}

/** Every Find a Doc form type, in registry order. A clinic's own forms come from the database. */
export function listFormSources(): FormSource[] {
    return Object.values(FORMS_BY_ID)
}

export function isFindadocFormId(formId: string): boolean {
    return FORMS_BY_ID[formId] !== undefined
}

/** Which of these ids are forms this clinic wrote. */
export async function clinicFormIdsFor(facilityId: string, formIds: readonly string[]): Promise<Set<string>> {
    const candidates = formIds.filter(isClinicFormId)
    if (candidates.length === 0) {
        return new Set()
    }
    const rows = await db.selectFrom('booking_form_definitions')
        .select('id')
        .where('facility_id', '=', facilityId)
        .where('id', 'in', candidates)
        .execute()
    return new Set(rows.map(row => row.id))
}

/**
 * Stored answers for staff, in the form's order with the full name first. A file
 * field's answer is its upload id; the file is listed under uploads instead, so
 * it is left out here, as is any answer that is one of the request's upload ids.
 * `fields` are the questions of the form version the patient answered.
 */
export function staffAnswers(
    fields: readonly BookingFormField[],
    answers: Record<string, unknown>,
    uploadIds: ReadonlySet<string>
): Array<{ fieldId: string, value: string | null }> {
    const fileFieldIds = new Set(fields
        .filter(formField => formField.type === BookingFormFieldType.File)
        .map(formField => formField.id))
    const order = fields.map(formField => formField.id)
    const rank = (fieldId: string) => {
        if (fieldId === 'fullName') {
            return -1
        }
        const index = order.indexOf(fieldId)
        return index === -1 ? order.length : index
    }
    return Object.entries(answers)
        .filter(([fieldId, value]) => !fileFieldIds.has(fieldId) && !(typeof value === 'string' && uploadIds.has(value)))
        .sort(([a], [b]) => rank(a) - rank(b))
        .map(([fieldId, value]) => ({ fieldId, value: typeof value === 'string' ? value : null }))
}

/**
 * Known ids only, without repeats, in the clinic's order. Falls back to the default form.
 * `clinicFormIds` are the clinic's own forms (clinicFormIdsFor). Another clinic's form is dropped.
 */
export function parseFormDefinitionIds(value: unknown, clinicFormIds: ReadonlySet<string> = new Set()): string[] {
    const ids: string[] = []
    if (Array.isArray(value)) {
        for (const item of value) {
            if (typeof item === 'string'
                && (isFindadocFormId(item) || clinicFormIds.has(item))
                && !ids.includes(item)) {
                ids.push(item)
            }
        }
    }
    return ids.length > 0 ? ids : [DEFAULT_BOOKING_FORM_ID]
}

/**
 * `?form=` may pick any form the clinic offers. Anything else gets the clinic default.
 * `offeredFormIds` is the clinic's parsed list (parseFormDefinitionIds).
 */
export function chooseFormDefinitionId(
    offeredFormIds: readonly string[],
    requestedFormId?: string | null
): string {
    if (requestedFormId !== null && requestedFormId !== undefined && offeredFormIds.includes(requestedFormId)) {
        return requestedFormId
    }
    return offeredFormIds[0] ?? DEFAULT_BOOKING_FORM_ID
}

/** True when the clinic offers this exact form id. Submit and upload require it. */
export function isOfferedFormId(offeredFormIds: readonly string[], formId: string): boolean {
    return offeredFormIds.includes(formId)
}

/** A form without the clinic's doctors and languages, which come from the database. */
export type AssembledBookingForm = Omit<BookingForm, 'practitioners' | 'languages'>

export function assembleBookingForm(input: {
    source: FormSource
    facilityId?: string | null
    clinicSiteId?: string | null
    clinicSiteSlug?: string | null
    clinicName: string
    themePrimary?: string | null
    allowedDurations?: readonly number[]
    defaultDuration?: number | null
}): AssembledBookingForm {
    const source = input.source
    const allowedDurations = [...(input.allowedDurations ?? DEFAULT_ALLOWED_DURATIONS)]

    return {
        id: source.id,
        version: source.version,
        facilityId: input.facilityId ?? null,
        clinicSiteId: input.clinicSiteId ?? null,
        clinicSiteSlug: input.clinicSiteSlug ?? null,
        clinicName: input.clinicName,
        themePrimary: input.themePrimary ?? null,
        allowedDurations,
        defaultDuration: resolveDefaultDuration(allowedDurations, input.defaultDuration)
            ?? DEFAULT_APPOINTMENT_DURATION_MINUTES,
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
