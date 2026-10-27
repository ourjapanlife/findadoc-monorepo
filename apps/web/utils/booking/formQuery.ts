import { gql } from 'graphql-request'
import type { BookingForm, BookingSubmissionResult, BookingUploadUrl } from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

const BOOKING_FORM_FIELDS = `
  id
  version
  clinicSiteId
  clinicSiteSlug
  clinicName
  themePrimary
  notifyEmail
  fields {
    id
    type
    required
    labelKey
    label
    placeholderKey
    accept
    maxLength
    maxBytes
    min
    max
    options { value labelKey label }
  }
`

const bookingFormQuery = gql`
  query BookingForm($clinicSiteId: ID!) {
    bookingForm(clinicSiteId: $clinicSiteId) {
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

const submitBookingMutation = gql`
  mutation SubmitBooking($input: SubmitBookingInput!) {
    submitBooking(input: $input) {
      id
      clinicSiteId
      status
      createdDate
    }
  }
`

export async function fetchBookingForm(clinicSiteId: string): Promise<BookingForm | null> {
    if (!clinicSiteId) {
        return null
    }
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{ bookingForm: BookingForm | null }>(
        gqlClient.request.bind(gqlClient),
        bookingFormQuery,
        { clinicSiteId },
        { skipAuth: true, retryAmount: 1, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.bookingForm ?? null
}

export async function requestBookingUploadUrl(input: {
    clinicSiteId: string
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
