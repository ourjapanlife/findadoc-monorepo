import { gql } from 'graphql-request'
import type {
    BookingPaymentSettings,
    PaymentQrUploadUrl,
    UpdateBookingPaymentSettingsInput
} from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry, initializeGqlClient } from '~/utils/graphql'

/**
 * Clinic payment settings for the pending-payment email (online consult v2 §3.3).
 * Owners and admins change them; the API checks which clinic on every call.
 */

const PAYMENT_SETTINGS_FIELDS = `
  facilityId
  cardMode
  cardUrl
  bankName
  bankBranch
  bankAccountType
  bankAccountNumber
  bankAccountHolder
  hasPayPayQr
  payPayQrPreviewUrl
  feeJpy
  canManage
`

const paymentSettingsQuery = gql`
  query BookingPaymentSettings($facilityId: ID!) {
    bookingPaymentSettings(facilityId: $facilityId) {
      ${PAYMENT_SETTINGS_FIELDS}
    }
  }
`

const updatePaymentSettingsMutation = gql`
  mutation UpdateBookingPaymentSettings($input: UpdateBookingPaymentSettingsInput!) {
    updateBookingPaymentSettings(input: $input) {
      ${PAYMENT_SETTINGS_FIELDS}
    }
  }
`

const paymentQrUploadMutation = gql`
  mutation CreatePaymentQrUploadUrl($input: CreatePaymentQrUploadUrlInput!) {
    createPaymentQrUploadUrl(input: $input) {
      objectKey
      uploadUrl
      headers {
        name
        value
      }
      expiresAt
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

/** `settings` is null when the clinic saved none yet. The whole result is null when the request failed. */
export async function fetchBookingPaymentSettings(
    facilityId: string
): Promise<{ settings: BookingPaymentSettings | null } | null> {
    const data = await request<{ bookingPaymentSettings: BookingPaymentSettings | null }>(
        paymentSettingsQuery,
        { facilityId },
        READ
    )
    return data === null ? null : { settings: data.bookingPaymentSettings ?? null }
}

export async function updateBookingPaymentSettings(
    input: UpdateBookingPaymentSettingsInput
): Promise<BookingPaymentSettings | null> {
    const data = await request<{ updateBookingPaymentSettings: BookingPaymentSettings }>(
        updatePaymentSettingsMutation,
        { input },
        WRITE
    )
    return data?.updateBookingPaymentSettings ?? null
}

export async function createPaymentQrUploadUrl(
    facilityId: string,
    file: File
): Promise<PaymentQrUploadUrl | null> {
    const data = await request<{ createPaymentQrUploadUrl: PaymentQrUploadUrl }>(
        paymentQrUploadMutation,
        { input: { facilityId, contentType: file.type, byteSize: file.size } },
        WRITE
    )
    return data?.createPaymentQrUploadUrl ?? null
}
