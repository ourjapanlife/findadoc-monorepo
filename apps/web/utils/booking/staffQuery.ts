import { gql } from 'graphql-request'
import type {
    BookingSubmissionDetail,
    BookingSubmissionListItem,
    BookingSubmissionSearchFilters,
    BookingUploadDownloadUrl,
    ClinicAvailabilityWindow,
    CreateClinicAvailabilityWindowInput,
    DeleteResult
} from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

const LIST_ITEM_FIELDS = `
  id
  clinicSiteId
  facilityId
  clinicSiteSlug
  clinicName
  locale
  status
  formDefinitionId
  formVersion
  startsAt
  endsAt
  createdDate
  updatedDate
  hasIdentityUploads
`

const DETAIL_FIELDS = `
  ${LIST_ITEM_FIELDS}
  practitionerId
  service
  answers { fieldId value }
  uploads {
    id
    fieldId
    fileName
    contentType
    sensitivity
    retainUntil
    purgedAt
    byteSize
  }
`

const listQuery = gql`
  query BookingSubmissions($filters: BookingSubmissionSearchFilters!) {
    bookingSubmissions(filters: $filters) {
      ${LIST_ITEM_FIELDS}
    }
    bookingSubmissionsTotalCount(filters: $filters)
  }
`

const detailQuery = gql`
  query BookingSubmission($id: ID!) {
    bookingSubmission(id: $id) {
      ${DETAIL_FIELDS}
    }
  }
`

const downloadMutation = gql`
  mutation BookingUploadDownloadUrl($uploadId: ID!) {
    bookingUploadDownloadUrl(uploadId: $uploadId) {
      uploadId
      downloadUrl
      expiresAt
    }
  }
`

const availabilityQuery = gql`
  query ClinicAvailabilityWindows($clinicSiteId: ID!, $from: String!, $to: String!) {
    clinicAvailabilityWindows(clinicSiteId: $clinicSiteId, from: $from, to: $to) {
      id
      clinicSiteId
      startsAt
      endsAt
      createdDate
    }
  }
`

const createAvailabilityMutation = gql`
  mutation CreateClinicAvailabilityWindow($input: CreateClinicAvailabilityWindowInput!) {
    createClinicAvailabilityWindow(input: $input) {
      id
      clinicSiteId
      startsAt
      endsAt
      createdDate
    }
  }
`

const deleteAvailabilityMutation = gql`
  mutation DeleteClinicAvailabilityWindow($id: ID!) {
    deleteClinicAvailabilityWindow(id: $id) {
      isSuccessful
    }
  }
`

export async function fetchBookingSubmissions(filters: BookingSubmissionSearchFilters): Promise<{
    rows: BookingSubmissionListItem[]
    totalCount: number
}> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        bookingSubmissions: BookingSubmissionListItem[]
        bookingSubmissionsTotalCount: number
    }>(
        gqlClient.request.bind(gqlClient),
        listQuery,
        { filters },
        { retryAmount: 1, abortAfterMs: 10000 }
    )
    if (response.hasErrors) {
        return { rows: [], totalCount: 0 }
    }
    return {
        rows: response.data.bookingSubmissions ?? [],
        totalCount: response.data.bookingSubmissionsTotalCount ?? 0
    }
}

export async function fetchBookingSubmissionDetail(
    id: string
): Promise<BookingSubmissionDetail | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        bookingSubmission: BookingSubmissionDetail | null
    }>(
        gqlClient.request.bind(gqlClient),
        detailQuery,
        { id },
        { retryAmount: 1, abortAfterMs: 10000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.bookingSubmission ?? null
}

export async function requestBookingUploadDownloadUrl(
    uploadId: string
): Promise<BookingUploadDownloadUrl | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        bookingUploadDownloadUrl: BookingUploadDownloadUrl
    }>(
        gqlClient.request.bind(gqlClient),
        downloadMutation,
        { uploadId },
        { retryAmount: 0, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.bookingUploadDownloadUrl
}

export async function fetchClinicAvailabilityWindows(
    clinicSiteId: string,
    from: string,
    to: string
): Promise<ClinicAvailabilityWindow[]> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        clinicAvailabilityWindows: ClinicAvailabilityWindow[]
    }>(
        gqlClient.request.bind(gqlClient),
        availabilityQuery,
        { clinicSiteId, from, to },
        { retryAmount: 1, abortAfterMs: 10000 }
    )
    if (response.hasErrors) {
        return []
    }
    return response.data.clinicAvailabilityWindows ?? []
}

export async function createClinicAvailabilityWindow(
    input: CreateClinicAvailabilityWindowInput
): Promise<ClinicAvailabilityWindow | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        createClinicAvailabilityWindow: ClinicAvailabilityWindow
    }>(
        gqlClient.request.bind(gqlClient),
        createAvailabilityMutation,
        { input },
        { retryAmount: 0, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.createClinicAvailabilityWindow
}

export async function deleteClinicAvailabilityWindow(id: string): Promise<DeleteResult | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<{
        deleteClinicAvailabilityWindow: DeleteResult
    }>(
        gqlClient.request.bind(gqlClient),
        deleteAvailabilityMutation,
        { id },
        { retryAmount: 0, abortAfterMs: 8000 }
    )
    if (response.hasErrors) {
        return null
    }
    return response.data.deleteClinicAvailabilityWindow
}
