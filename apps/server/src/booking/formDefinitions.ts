import {
    BookingFieldSensitivity,
    BookingFormFieldType,
    BookingPhoneRegion,
    type BookingForm,
    type BookingFormField
} from '@findadoc/graphql'
import { formatJapanPhone, PHONE_DISPLAY } from '../../utils/stringUtils.js'
import { BOOKING_UPLOAD_MAX_BYTES } from './limits.js'
import { BOOKING_FIELD_SENSITIVITY, type BookingFieldSensitivity as StoredSensitivity } from './retention.js'
import {
    DEFAULT_ALLOWED_DURATIONS,
    DEFAULT_APPOINTMENT_DURATION_MINUTES,
    JST_OFFSET_MS,
    resolveDefaultDuration
} from './schedule.js'

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
    partial: Omit<
        BookingFormField,
        'sensitivity' | 'label' | 'placeholderKey' | 'hintKey' | 'accept' | 'maxLength' | 'maxBytes' | 'min' | 'max'
        | 'options' | 'showWhen' | 'phoneRegion'
    >
    & Partial<BookingFormField>
    & { sensitivity?: BookingFormField['sensitivity'] }
): BookingFormField {
    return {
        label: null,
        placeholderKey: null,
        hintKey: null,
        accept: null,
        maxLength: null,
        maxBytes: null,
        min: null,
        max: null,
        options: null,
        showWhen: null,
        phoneRegion: null,
        sensitivity: BookingFieldSensitivity.Standard,
        ...partial
    }
}

/**
 * Gender choices on the online consult form: Male, Female, and Other. `selfDescribe` is
 * labelled "Other" and shows a text field for the patient's own words. The stored values
 * are the version 3 values, so older requests still read the same; `preferNotToSay` is
 * no longer offered, but staff still see its label on a version 3 request.
 * Under the APPI this is ordinary personal information, not special care-required data;
 * the hint on the form says why it is asked.
 */
export const GENDER_OPTIONS = ['male', 'female', 'selfDescribe'] as const

/** Apps a patient may name as a second way to reach them. */
export const BACKUP_CONTACT_CHANNELS = ['line', 'whatsapp', 'messenger'] as const

/** How much Japanese the patient speaks, so the coordinator can plan the call. */
export const JAPANESE_LEVELS = ['none', 'greetings', 'little', 'conversational', 'fluent'] as const

/**
 * The language the patient wants the consultation in. A plain answer for the coordinator:
 * it does not route doctors or interpreters, which the language chips still do. The values
 * are short language codes, not site locales, because Burmese is not a site locale.
 */
export const CONSULTATION_LANGUAGES = ['ja', 'en', 'zh', 'vi', 'id', 'tl', 'fr', 'ne', 'my'] as const

/** How the patient will pay the initial fee. The clinic sends instructions for the chosen one. */
export const PAYMENT_METHODS = ['creditCard', 'bankTransfer', 'payPay'] as const

/** Oldest date of birth the form accepts, in calendar years before today. */
export const OLDEST_BIRTH_DATE_YEARS = -120

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

/** Select options labelled by `bookingPage.options.{fieldId}.{value}`, which staff detail also reads. */
function selectOptions(fieldId: string, values: readonly string[]): BookingFormField['options'] {
    return values.map(value => ({ value, labelKey: `bookingPage.options.${fieldId}.${value}`, label: null }))
}

const showcaseFields: BookingFormField[] = [
    contactAndVisitFields[0]!,
    // The coordinator calls the patient in Japan, so this form takes a Japanese number only.
    { ...contactAndVisitFields[1]!, phoneRegion: BookingPhoneRegion.Jp },
    contactAndVisitFields[2]!,
    // Date of birth, not age: it identifies the patient, matches the insurance card, and
    // does not go stale. Version 2 requests still carry `age` and staff still see it.
    field({
        id: 'dateOfBirth',
        stepKey: 'contact',
        type: BookingFormFieldType.Date,
        required: true,
        labelKey: 'bookingPage.fields.dateOfBirth',
        hintKey: 'bookingPage.hints.dateOfBirth',
        min: OLDEST_BIRTH_DATE_YEARS,
        max: 0
    }),
    field({
        id: 'gender',
        stepKey: 'contact',
        type: BookingFormFieldType.Select,
        required: true,
        labelKey: 'bookingPage.fields.gender',
        hintKey: 'bookingPage.hints.gender',
        options: selectOptions('gender', GENDER_OPTIONS)
    }),
    field({
        id: 'genderSelfDescribed',
        stepKey: 'contact',
        type: BookingFormFieldType.Text,
        required: true,
        labelKey: 'bookingPage.fields.genderSelfDescribed',
        maxLength: 60,
        showWhen: { fieldId: 'gender', equals: 'selfDescribe' }
    }),
    // Personal data, like the name and phone. It is never logged.
    field({
        id: 'addressInJapan',
        stepKey: 'contact',
        type: BookingFormFieldType.Textarea,
        required: true,
        labelKey: 'bookingPage.fields.addressInJapan',
        placeholderKey: 'bookingPage.placeholders.addressInJapan',
        maxLength: 300
    }),
    field({
        id: 'backupContactChannel',
        stepKey: 'contact',
        type: BookingFormFieldType.Select,
        required: false,
        labelKey: 'bookingPage.fields.backupContactChannel',
        options: selectOptions('backupContactChannel', BACKUP_CONTACT_CHANNELS)
    }),
    // Required once any app is chosen; hidden and dropped when none is.
    field({
        id: 'backupContactHandle',
        stepKey: 'contact',
        type: BookingFormFieldType.Text,
        required: true,
        labelKey: 'bookingPage.fields.backupContactHandle',
        maxLength: 120,
        showWhen: { fieldId: 'backupContactChannel', equals: null, anyOf: [...BACKUP_CONTACT_CHANNELS] }
    }),
    field({
        id: 'japaneseLevel',
        stepKey: 'visit',
        type: BookingFormFieldType.Select,
        required: true,
        labelKey: 'bookingPage.fields.japaneseLevel',
        options: selectOptions('japaneseLevel', JAPANESE_LEVELS)
    }),
    field({
        id: 'consultationLanguage',
        stepKey: 'visit',
        type: BookingFormFieldType.Select,
        required: true,
        labelKey: 'bookingPage.fields.consultationLanguage',
        hintKey: 'bookingPage.hints.consultationLanguage',
        options: selectOptions('consultationLanguage', CONSULTATION_LANGUAGES)
    }),
    // Same answer id as the default form's reason, so lists and exports read one key.
    {
        ...contactAndVisitFields[3]!,
        labelKey: 'bookingPage.fields.currentSymptoms',
        placeholderKey: 'bookingPage.placeholders.currentSymptoms'
    },
    field({
        id: 'pastIllnesses',
        stepKey: 'visit',
        type: BookingFormFieldType.Textarea,
        required: false,
        labelKey: 'bookingPage.fields.pastIllnesses',
        placeholderKey: 'bookingPage.placeholders.pastIllnesses',
        maxLength: 2000,
        sensitivity: BookingFieldSensitivity.Medical
    }),
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
            label: null
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
    }),
    // The hint under it says the visit is not confirmed until the clinic has the first payment.
    field({
        id: 'paymentMethod',
        stepKey: 'payment',
        type: BookingFormFieldType.Select,
        required: true,
        labelKey: 'bookingPage.fields.paymentMethod',
        hintKey: 'bookingPage.hints.paymentMethod',
        options: selectOptions('paymentMethod', PAYMENT_METHODS)
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
        // 2 asks which proof of insurance the patient has.
        // 3 asks date of birth and gender instead of age.
        // 4 adds address, backup contact, Japanese level, consultation language, past
        // illnesses, and payment method, and takes a Japanese phone number only.
        version: 4,
        labelKey: 'bookingForms.onlineConsultIntake',
        fields: showcaseFields
    }
}

/**
 * Whether a field is shown for these answers. A field with `showWhen` is shown only
 * while that other field's trimmed answer equals `equals` or is one of `anyOf`;
 * otherwise it is not required and its answer is dropped.
 */
export function fieldIsShown(
    formField: Pick<BookingFormField, 'showWhen'>,
    answerFor: (fieldId: string) => string
): boolean {
    const condition = formField.showWhen
    if (condition === null || condition === undefined) {
        return true
    }
    const answer = answerFor(condition.fieldId)
    if (answer === '') {
        return false
    }
    return answer === condition.equals || (condition.anyOf ?? []).includes(answer)
}

/** A phone answer needs this many digits when the field takes any country. */
const MIN_PHONE_DIGITS = 8

/**
 * The phone answer to store, or null when this field does not accept it. A JP field
 * takes any spelling of a Japanese number (`09012345678`, `+81 90 1234 5678`, full-width)
 * and stores the domestic form, `090-1234-5678`. Any other phone field needs
 * MIN_PHONE_DIGITS digits and is stored as typed. The web copy is in
 * `apps/web/utils/booking/formFields.ts`.
 */
export function phoneAnswer(formField: Pick<BookingFormField, 'phoneRegion'>, raw: string): string | null {
    if (formField.phoneRegion === BookingPhoneRegion.Jp) {
        return formatJapanPhone(raw, PHONE_DISPLAY.NATIONAL)
    }
    return raw.replace(/\D/g, '').length >= MIN_PHONE_DIGITS ? raw : null
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isoDate(year: number, monthIndex: number, day: number): string {
    return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Today in Japan moved by whole calendar years, as `YYYY-MM-DD`. 29 February in a
 * year without one becomes 28 February, so a birthday is never pushed into March.
 */
export function japanDateYearsFromToday(years: number, now: Date = new Date()): string {
    const japanNow = new Date(now.getTime() + JST_OFFSET_MS)
    const year = japanNow.getUTCFullYear() + Math.trunc(years)
    const monthIndex = japanNow.getUTCMonth()
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    return isoDate(year, monthIndex, Math.min(japanNow.getUTCDate(), lastDay))
}

/**
 * A DATE answer is a real calendar day, YYYY-MM-DD, inside the field's range.
 * `min` and `max` are whole calendar years from today in Japan time, so a date of
 * birth uses `min: -120` (the 120th birthday today still counts) and `max: 0`.
 */
export function dateAnswerIsValid(
    raw: string,
    range: { min?: number | null, max?: number | null },
    now: Date = new Date()
): boolean {
    const match = ISO_DATE_PATTERN.exec(raw)
    if (match === null) {
        return false
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        return false
    }
    // Same-width ISO dates compare in calendar order.
    if (range.min !== null && range.min !== undefined && raw < japanDateYearsFromToday(range.min, now)) {
        return false
    }
    if (range.max !== null && range.max !== undefined && raw > japanDateYearsFromToday(range.max, now)) {
        return false
    }
    return true
}

export function formSourceById(formId: string): FormSource | undefined {
    return FORMS_BY_ID[formId]
}

/** Every form type a clinic may offer, in registry order. */
export function listFormSources(): FormSource[] {
    return Object.values(FORMS_BY_ID)
}

/**
 * Stored answers for staff, in the form's order with the full name first. A file
 * field's answer is its upload id; the file is listed under uploads instead, so
 * it is left out here, as is any answer that is one of the request's upload ids.
 */
export function staffAnswers(
    formDefinitionId: string,
    answers: Record<string, unknown>,
    uploadIds: ReadonlySet<string>
): Array<{ fieldId: string, value: string | null, labelKey: string | null }> {
    const fields = formSourceById(formDefinitionId)?.fields ?? []
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
        .map(([fieldId, value]) => ({
            fieldId,
            value: typeof value === 'string' ? value : null,
            // The form's own label, so the online consult reason reads "Current symptoms".
            labelKey: fields.find(formField => formField.id === fieldId)?.labelKey ?? null
        }))
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

/** A form without the clinic's doctors, languages, and interpretation (#205), which come from the database. */
export type AssembledBookingForm = Omit<
    BookingForm,
    'practitioners' | 'languages' | 'offersInterpretation' | 'interpreters'
>

export function assembleBookingForm(input: {
    formDefinitionId?: string | null
    facilityId?: string | null
    clinicSiteId?: string | null
    clinicSiteSlug?: string | null
    clinicName: string
    themePrimary?: string | null
    allowedDurations?: readonly number[]
    defaultDuration?: number | null
}): AssembledBookingForm {
    const source = resolveFormSource(input.formDefinitionId ?? DEFAULT_BOOKING_FORM_ID)
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
