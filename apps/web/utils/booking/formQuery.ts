import { gql } from 'graphql-request'
import type {
    BookingForm,
    BookingSubmissionResult,
    BookingUploadUrl,
    Locale,
    PatientBookingView
} from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'
import { ErrorCode, type ServerResponse } from '~/typedefs/serverResponse'

/**
 * Why a public booking call failed. `rateLimited` and `openRequestLimit` have their own
 * sentence on the form (#160), and `regionUnavailable` means the visitor is not in Japan (#173).
 * Anything else is `failed`.
 */
export type BookingRefusal = 'failed' | 'rateLimited' | 'openRequestLimit' | 'regionUnavailable'

export function bookingRefusal(response: Pick<ServerResponse<unknown>, 'errors'>): BookingRefusal {
    const codes = (response.errors ?? []).map(error => error.code)
    if (codes.includes(ErrorCode.BOOKING_REGION_UNAVAILABLE)) {
        return 'regionUnavailable'
    }
    if (codes.includes(ErrorCode.TOO_MANY_REQUESTS)) {
        return 'rateLimited'
    }
    if (codes.includes(ErrorCode.OPEN_REQUEST_LIMIT)) {
        return 'openRequestLimit'
    }
    return 'failed'
}

export function isBookingRefusal(value: unknown): value is BookingRefusal {
    return value === 'failed'
      || value === 'rateLimited'
      || value === 'openRequestLimit'
      || value === 'regionUnavailable'
}

/** Both Book page boxes: "I am currently in Japan" and the health-data consent (#173). */
export type BookingConfirmations = {
    confirmedInJapan: boolean
    healthDataConsent: boolean
}

export function bookingConfirmationsComplete(confirmations: BookingConfirmations): boolean {
    return confirmations.confirmedInJapan && confirmations.healthDataConsent
}

const BOOKING_FORM_FIELDS = `
  id
  version
  facilityId
  clinicSiteId
  clinicSiteSlug
  clinicName
  themePrimary
  allowedDurations
  defaultDuration
  fields {
    id
    type
    stepKey
    required
    labelKey
    label
    placeholderKey
    hintKey
    accept
    maxLength
    maxBytes
    min
    max
    sensitivity
    options { value labelKey label }
    showWhen { fieldId equals }
  }
  practitioners {
    id
    names { firstName middleName lastName locale }
    spokenLanguages
    specialties
    hasOwnSchedule
  }
  languages
`

const bookingFormQuery = gql`
  query BookingForm($clinicSiteId: ID!, $formId: String) {
    bookingForm(clinicSiteId: $clinicSiteId, formId: $formId) {
      ${BOOKING_FORM_FIELDS}
    }
  }
`

const bookingAvailableQuery = gql`
  query BookingAvailable {
    bookingAvailable
  }
`

const createUploadMutation = gql`
  mutation CreateBookingUploadUrl($input: CreateBookingUploadUrlInput!) {
    createBookingUploadUrl(input: $input) {
      uploadId
      objectKey
      uploadUrl
      expiresAt
      headers { name value }
    }
  }
`

const availableStartsQuery = gql`
  query AvailableBookingStarts(
    $clinicSiteId: ID!
    $from: String!
    $to: String!
    $durationMinutes: Int
    $practitionerId: ID
    $spokenLanguages: [Locale!]
  ) {
    availableBookingStarts(
      clinicSiteId: $clinicSiteId
      from: $from
      to: $to
      durationMinutes: $durationMinutes
      practitionerId: $practitionerId
      spokenLanguages: $spokenLanguages
    )
  }
`

const submitBookingMutation = gql`
  mutation SubmitBooking($input: SubmitBookingInput!) {
    submitBooking(input: $input) {
      id
      clinicSiteId
      facilityId
      status
      appointmentId
      createdDate
      manageToken
    }
  }
`

export function bookingClinicKey(form: Pick<BookingForm, 'facilityId' | 'clinicSiteId'>): string {
    return form.facilityId ?? form.clinicSiteId ?? ''
}

export async function fetchBookingForm(clinicId: string, formId?: string): Promise<BookingForm | null> {
    if (!clinicId) {
        return null
    }
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ bookingForm: BookingForm | null }>(
        gqlClient.request.bind(gqlClient),
        bookingFormQuery,
        { clinicSiteId: clinicId, formId },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.bookingForm ?? null
}

/**
 * The API's answer to `bookingAvailable`, or null when there is no answer (#188). A failed
 * or timed-out call is not a yes and not a region refusal: the Book page shows neither the
 * form nor the region notice until a retry gets an answer.
 */
export function bookingAvailability(
    response: Pick<ServerResponse<{ bookingAvailable?: boolean | null }>, 'data' | 'hasErrors'>
): boolean | null {
    if (response.hasErrors) {
        return null
    }
    const available = response.data.bookingAvailable
    return typeof available === 'boolean' ? available : null
}

/**
 * Whether the API takes booking requests from this visitor. Booking is offered only to
 * people in Japan, and the server decides (#173). Null means the call failed and nothing
 * was decided (#188). Submit and uploads still check the region on the server.
 */
export async function fetchBookingAvailable(): Promise<boolean | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ bookingAvailable: boolean }>(
        gqlClient.request.bind(gqlClient),
        bookingAvailableQuery,
        {},
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    return bookingAvailability(response)
}

export async function requestBookingUploadUrl(input: {
    clinicSiteId: string
    formDefinitionId: string
    fieldId: string
    contentType: string
    fileName: string
    byteSize: number
}): Promise<BookingUploadUrl | BookingRefusal> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ createBookingUploadUrl: BookingUploadUrl }>(
        gqlClient.request.bind(gqlClient),
        createUploadMutation,
        { input },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return bookingRefusal(response)
    }
    return response.data.createBookingUploadUrl
}

export async function submitBookingForm(input: {
    clinicSiteId: string
    formDefinitionId: string
    formVersion: number
    locale: string
    answers: Array<{ fieldId: string, value?: string | null, uploadId?: string | null }>
    startsAt: string
    durationMinutes: number
    practitionerId?: string | null
    spokenLanguages?: Locale[]
    service?: string | null
} & BookingConfirmations): Promise<BookingSubmissionResult | BookingRefusal> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ submitBooking: BookingSubmissionResult }>(
        gqlClient.request.bind(gqlClient),
        submitBookingMutation,
        { input },
        { skipAuth: true, retryAmount: 0, abortAfterMs: 15000 }
    )
    if (response.hasErrors) {
        return bookingRefusal(response)
    }
    return response.data.submitBooking
}

/** Open starts. A doctor narrows them to that doctor; languages narrow "any doctor" to those who speak them. */
export async function fetchAvailableBookingStarts(
    clinicId: string,
    from: string,
    to: string,
    durationMinutes: number,
    choice: { practitionerId?: string | null, spokenLanguages?: readonly Locale[] } = {}
): Promise<string[]> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        availableBookingStarts: string[]
    }>(
        gqlClient.request.bind(gqlClient),
        availableStartsQuery,
        {
            clinicSiteId: clinicId,
            from,
            to,
            durationMinutes,
            practitionerId: choice.practitionerId ?? null,
            spokenLanguages: choice.spokenLanguages ?? []
        },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return []
    }
    return response.data.availableBookingStarts ?? []
}

export async function putBookingFile(
    uploadUrl: string,
    file: File,
    headers: Array<{ name: string, value: string }>
): Promise<boolean> {
    const requestHeaders = new Headers()
    for (const header of headers) {
        requestHeaders.set(header.name, header.value)
    }
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: requestHeaders,
        body: file
    })
    return response.ok
}

const PATIENT_BOOKING_FIELDS = `
  clinicName
  startsAt
  endsAt
  status
  canCancel
`

const patientBookingQuery = gql`
  query PatientBooking($token: String!) {
    patientBooking(token: $token) {
      ${PATIENT_BOOKING_FIELDS}
    }
  }
`

const cancelBookingByTokenMutation = gql`
  mutation CancelBookingByToken($input: CancelBookingByTokenInput!) {
    cancelBookingByToken(input: $input) {
      ${PATIENT_BOOKING_FIELDS}
    }
  }
`

/** The patient's own booking from the private link. Null when the token is unknown. */
export async function fetchPatientBooking(token: string): Promise<PatientBookingView | null | BookingRefusal> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ patientBooking: PatientBookingView | null }>(
        gqlClient.request.bind(gqlClient),
        patientBookingQuery,
        { token },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return bookingRefusal(response)
    }
    return response.data.patientBooking ?? null
}

export async function cancelPatientBooking(token: string, reason: string): Promise<PatientBookingView | BookingRefusal> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ cancelBookingByToken: PatientBookingView }>(
        gqlClient.request.bind(gqlClient),
        cancelBookingByTokenMutation,
        { input: { token, reason: reason.trim() || null } },
        { skipAuth: true, retryAmount: 0, abortAfterMs: 15000 }
    )
    if (response.hasErrors) {
        return bookingRefusal(response)
    }
    return response.data.cancelBookingByToken
}
