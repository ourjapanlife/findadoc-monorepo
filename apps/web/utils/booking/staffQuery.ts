import { gql } from 'graphql-request'
import type {
    BookingAppointment,
    BookingAppointmentStatus,
    BookingClinic,
    BookingFormType,
    BookingSettings,
    BookingSubmissionDetail,
    BookingSubmissionListItem,
    BookingSubmissionSearchFilters,
    BookingUploadDownloadUrl,
    ClinicAvailabilityWindow,
    ClinicMember,
    ClinicMemberRole,
    CreateClinicAvailabilityWindowInput,
    DeleteResult,
    UpdateBookingSettingsInput
} from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

/**
 * Staff booking reads and writes. The API limits every call to the clinics the
 * signed-in user belongs to; moderators reach every clinic.
 */

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
  appointmentId
  appointmentStatus
  patientName
  createdDate
  updatedDate
  hasIdentityUploads
`

const DETAIL_FIELDS = `
  ${LIST_ITEM_FIELDS}
  cancelledBy
  statusReason
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

const APPOINTMENT_FIELDS = `
  id
  bookingSubmissionId
  facilityId
  startsAt
  endsAt
  durationMinutes
  status
  patientName
`

const CLINIC_FIELDS = `
  facilityId
  clinicName
  clinicSiteSlug
  role
  canManage
`

const MEMBER_FIELDS = `
  id
  facilityId
  email
  role
  claimed
  createdDate
`

const SETTINGS_FIELDS = `
  facilityId
  allowedDurations
  formDefinitionIds
`

const WINDOW_FIELDS = `
  id
  clinicSiteId
  facilityId
  startsAt
  endsAt
  createdDate
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
      ${WINDOW_FIELDS}
    }
  }
`

const calendarQuery = gql`
  query ClinicCalendar($clinicId: ID!, $from: String!, $to: String!) {
    clinicAvailabilityWindows(clinicSiteId: $clinicId, from: $from, to: $to) {
      ${WINDOW_FIELDS}
    }
    clinicAppointments(clinicId: $clinicId, from: $from, to: $to) {
      ${APPOINTMENT_FIELDS}
    }
  }
`

const createAvailabilityMutation = gql`
  mutation CreateClinicAvailabilityWindow($input: CreateClinicAvailabilityWindowInput!) {
    createClinicAvailabilityWindow(input: $input) {
      ${WINDOW_FIELDS}
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

const updateStatusMutation = gql`
  mutation UpdateBookingAppointmentStatus($input: UpdateBookingAppointmentStatusInput!) {
    updateBookingAppointmentStatus(input: $input) {
      ${APPOINTMENT_FIELDS}
    }
  }
`

const myClinicsQuery = gql`
  query MyBookingClinics {
    myBookingClinics {
      ${CLINIC_FIELDS}
    }
  }
`

const clinicQuery = gql`
  query BookingClinic($facilityId: ID!) {
    bookingClinic(facilityId: $facilityId) {
      ${CLINIC_FIELDS}
    }
  }
`

const clinicAdminQuery = gql`
  query BookingClinicAdmin($facilityId: ID!) {
    bookingSettings(facilityId: $facilityId) {
      ${SETTINGS_FIELDS}
    }
    clinicMembers(facilityId: $facilityId) {
      ${MEMBER_FIELDS}
    }
    bookingFormTypes {
      id
      version
      labelKey
    }
  }
`

const inviteMutation = gql`
  mutation InviteClinicMember($input: InviteClinicMemberInput!) {
    inviteClinicMember(input: $input) {
      ${MEMBER_FIELDS}
    }
  }
`

const removeMemberMutation = gql`
  mutation RemoveClinicMember($id: ID!) {
    removeClinicMember(id: $id) {
      isSuccessful
    }
  }
`

const updateSettingsMutation = gql`
  mutation UpdateBookingSettings($input: UpdateBookingSettingsInput!) {
    updateBookingSettings(input: $input) {
      ${SETTINGS_FIELDS}
    }
  }
`

const READ = { retryAmount: 1, abortAfterMs: 10000 }
const WRITE = { retryAmount: 0, abortAfterMs: 8000 }

async function request<T>(
    document: string,
    variables: Record<string, unknown>,
    options: { retryAmount: number, abortAfterMs: number }
): Promise<T | null> {
    initializeGqlClient()
    const response = await graphQLClientRequestWithRetry<T>(
        gqlClient.request.bind(gqlClient),
        document,
        variables,
        options
    )
    return response.hasErrors ? null : response.data
}

export async function fetchBookingSubmissions(filters: BookingSubmissionSearchFilters): Promise<{
    rows: BookingSubmissionListItem[]
    totalCount: number
}> {
    const data = await request<{
        bookingSubmissions: BookingSubmissionListItem[]
        bookingSubmissionsTotalCount: number
    }>(listQuery, { filters }, READ)
    return {
        rows: data?.bookingSubmissions ?? [],
        totalCount: data?.bookingSubmissionsTotalCount ?? 0
    }
}

export async function fetchBookingSubmissionDetail(id: string): Promise<BookingSubmissionDetail | null> {
    const data = await request<{ bookingSubmission: BookingSubmissionDetail | null }>(detailQuery, { id }, READ)
    return data?.bookingSubmission ?? null
}

export async function requestBookingUploadDownloadUrl(uploadId: string): Promise<BookingUploadDownloadUrl | null> {
    const data = await request<{ bookingUploadDownloadUrl: BookingUploadDownloadUrl }>(
        downloadMutation,
        { uploadId },
        WRITE
    )
    return data?.bookingUploadDownloadUrl ?? null
}

export async function fetchClinicAvailabilityWindows(
    clinicSiteId: string,
    from: string,
    to: string
): Promise<ClinicAvailabilityWindow[]> {
    const data = await request<{ clinicAvailabilityWindows: ClinicAvailabilityWindow[] }>(
        availabilityQuery,
        { clinicSiteId, from, to },
        READ
    )
    return data?.clinicAvailabilityWindows ?? []
}

/** Availability and appointments for one calendar range. Null when the request failed. */
export async function fetchClinicCalendar(clinicId: string, from: string, to: string): Promise<{
    windows: ClinicAvailabilityWindow[]
    appointments: BookingAppointment[]
} | null> {
    const data = await request<{
        clinicAvailabilityWindows: ClinicAvailabilityWindow[]
        clinicAppointments: BookingAppointment[]
    }>(calendarQuery, { clinicId, from, to }, READ)
    if (data === null) {
        return null
    }
    return { windows: data.clinicAvailabilityWindows ?? [], appointments: data.clinicAppointments ?? [] }
}

export async function createClinicAvailabilityWindow(
    input: CreateClinicAvailabilityWindowInput
): Promise<ClinicAvailabilityWindow | null> {
    const data = await request<{ createClinicAvailabilityWindow: ClinicAvailabilityWindow }>(
        createAvailabilityMutation,
        { input },
        WRITE
    )
    return data?.createClinicAvailabilityWindow ?? null
}

export async function deleteClinicAvailabilityWindow(id: string): Promise<DeleteResult | null> {
    const data = await request<{ deleteClinicAvailabilityWindow: DeleteResult }>(
        deleteAvailabilityMutation,
        { id },
        WRITE
    )
    return data?.deleteClinicAvailabilityWindow ?? null
}

export async function updateAppointmentStatus(
    appointmentId: string,
    status: BookingAppointmentStatus,
    reason: string
): Promise<BookingAppointment | null> {
    const data = await request<{ updateBookingAppointmentStatus: BookingAppointment }>(
        updateStatusMutation,
        { input: { appointmentId, status, reason: reason.trim() || null } },
        WRITE
    )
    return data?.updateBookingAppointmentStatus ?? null
}

/** Null when the request failed, so the page can tell "no clinics" from "could not load". */
export async function fetchMyBookingClinics(): Promise<BookingClinic[] | null> {
    const data = await request<{ myBookingClinics: BookingClinic[] }>(myClinicsQuery, {}, READ)
    return data === null ? null : data.myBookingClinics ?? []
}

export async function fetchBookingClinic(facilityId: string): Promise<BookingClinic | null> {
    const data = await request<{ bookingClinic: BookingClinic | null }>(clinicQuery, { facilityId }, READ)
    return data?.bookingClinic ?? null
}

export async function fetchClinicAdmin(facilityId: string): Promise<{
    settings: BookingSettings | null
    members: ClinicMember[]
    formTypes: BookingFormType[]
} | null> {
    const data = await request<{
        bookingSettings: BookingSettings | null
        clinicMembers: ClinicMember[]
        bookingFormTypes: BookingFormType[]
    }>(clinicAdminQuery, { facilityId }, READ)
    if (data === null) {
        return null
    }
    return {
        settings: data.bookingSettings ?? null,
        members: data.clinicMembers ?? [],
        formTypes: data.bookingFormTypes ?? []
    }
}

export async function inviteClinicMember(
    facilityId: string,
    email: string,
    role: ClinicMemberRole
): Promise<ClinicMember | null> {
    const data = await request<{ inviteClinicMember: ClinicMember }>(
        inviteMutation,
        { input: { facilityId, email: email.trim(), role } },
        WRITE
    )
    return data?.inviteClinicMember ?? null
}

export async function removeClinicMember(id: string): Promise<boolean> {
    const data = await request<{ removeClinicMember: DeleteResult }>(removeMemberMutation, { id }, WRITE)
    return data?.removeClinicMember.isSuccessful === true
}

export async function updateBookingSettings(input: UpdateBookingSettingsInput): Promise<BookingSettings | null> {
    const data = await request<{ updateBookingSettings: BookingSettings }>(updateSettingsMutation, { input }, WRITE)
    return data?.updateBookingSettings ?? null
}
