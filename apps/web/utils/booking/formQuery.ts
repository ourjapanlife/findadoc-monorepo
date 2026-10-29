import { gql } from 'graphql-request'
import type {
    BookingForm,
    BookingSubmissionResult,
    BookingUploadUrl,
    PatientBookingView
} from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

const BOOKING_FORM_FIELDS = `
  id
  version
  facilityId
  clinicSiteId
  clinicSiteSlug
  clinicName
  themePrimary
  allowedDurations
  fields {
    id
    type
    stepKey
    required
    labelKey
    label
    placeholderKey
    accept
    maxLength
    maxBytes
    min
    max
    sensitivity
    options { value labelKey label }
  }
`

const bookingFormQuery = gql`
  query BookingForm($clinicSiteId: ID!, $formId: String) {
    bookingForm(clinicSiteId: $clinicSiteId, formId: $formId) {
      ${BOOKING_FORM_FIELDS}
    }
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
  query AvailableBookingStarts($clinicSiteId: ID!, $from: String!, $to: String!, $durationMinutes: Int) {
    availableBookingStarts(clinicSiteId: $clinicSiteId, from: $from, to: $to, durationMinutes: $durationMinutes)
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

export async function requestBookingUploadUrl(input: {
    clinicSiteId: string
    formDefinitionId: string
    fieldId: string
    contentType: string
    fileName: string
    byteSize: number
}): Promise<BookingUploadUrl | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ createBookingUploadUrl: BookingUploadUrl }>(
        gqlClient.request.bind(gqlClient),
        createUploadMutation,
        { input },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
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
    service?: string | null
}): Promise<BookingSubmissionResult | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ submitBooking: BookingSubmissionResult }>(
        gqlClient.request.bind(gqlClient),
        submitBookingMutation,
        { input },
        { skipAuth: true, retryAmount: 0, abortAfterMs: 15000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.submitBooking
}

export async function fetchAvailableBookingStarts(
    clinicId: string,
    from: string,
    to: string,
    durationMinutes: number
): Promise<string[]> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        availableBookingStarts: string[]
    }>(
        gqlClient.request.bind(gqlClient),
        availableStartsQuery,
        { clinicSiteId: clinicId, from, to, durationMinutes },
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

/** The patient's own booking from the private link. Null when the token is unknown or the request failed. */
export async function fetchPatientBooking(token: string): Promise<PatientBookingView | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ patientBooking: PatientBookingView | null }>(
        gqlClient.request.bind(gqlClient),
        patientBookingQuery,
        { token },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.patientBooking ?? null
}

export async function cancelPatientBooking(token: string, reason: string): Promise<PatientBookingView | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ cancelBookingByToken: PatientBookingView }>(
        gqlClient.request.bind(gqlClient),
        cancelBookingByTokenMutation,
        { input: { token, reason: reason.trim() || null } },
        { skipAuth: true, retryAmount: 0, abortAfterMs: 15000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.cancelBookingByToken
}
