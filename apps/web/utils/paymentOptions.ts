import { PaymentType, type PaymentOption, type PaymentOptionsInput } from '@findadoc/graphql'
import { isPaymentBrand, normalizePaymentOptions, PAYMENT_TYPE_BRANDS, type PaymentBrand } from '@findadoc/utils'

/**
 * Payment on a facility (#20). An empty list is unknown and readers see nothing.
 * Moderators fill it only from the clinic's site or a call.
 */

type Translate = (key: string) => string

// Literal t() calls, so i18n/cleanUnusedLocaleKeys.js sees each key as used.
/** The reader-facing name of a payment type. */
export function paymentTypeLabel(paymentType: PaymentType, t: Translate): string {
    const labels: Record<PaymentType, string> = {
        [PaymentType.Cash]: t('paymentOptions.types.cash'),
        [PaymentType.CreditCard]: t('paymentOptions.types.creditCard'),
        [PaymentType.DebitCard]: t('paymentOptions.types.debitCard'),
        [PaymentType.ElectronicMoney]: t('paymentOptions.types.electronicMoney'),
        [PaymentType.QrCode]: t('paymentOptions.types.qrCode')
    }
    return labels[paymentType]
}

/** The reader-facing name of a brand. IC names Suica and PASMO. */
export function paymentBrandLabel(brand: PaymentBrand, t: Translate): string {
    const labels: Record<PaymentBrand, string> = {
        Visa: t('paymentOptions.brands.visa'),
        Mastercard: t('paymentOptions.brands.mastercard'),
        'American Express': t('paymentOptions.brands.americanExpress'),
        JCB: t('paymentOptions.brands.jcb'),
        'Diners Club': t('paymentOptions.brands.dinersClub'),
        UnionPay: t('paymentOptions.brands.unionPay'),
        IC: t('paymentOptions.brands.ic'),
        PayPay: t('paymentOptions.brands.payPay'),
        Other: t('paymentOptions.brands.other')
    }
    return labels[brand]
}

/** Adds or removes a payment type. Removing it drops its brands. */
export function togglePaymentType(
    options: readonly PaymentOption[],
    paymentType: PaymentType,
    accepted: boolean
): PaymentOption[] {
    const others = options.filter(option => option.paymentType !== paymentType)
    return normalizePaymentOptions(accepted ? [...others, { paymentType, paymentBrands: [] }] : others)
}

/** Adds or removes one brand. Checking a brand also checks its type. */
export function togglePaymentBrand(
    options: readonly PaymentOption[],
    paymentType: PaymentType,
    brand: PaymentBrand,
    accepted: boolean
): PaymentOption[] {
    const current = options.find(option => option.paymentType === paymentType)
    const brands = (current?.paymentBrands ?? []).filter(existing => existing !== brand)
    const others = options.filter(option => option.paymentType !== paymentType)

    if (!current && !accepted) {
        return normalizePaymentOptions(others)
    }

    return normalizePaymentOptions([
        ...others,
        { paymentType, paymentBrands: accepted ? [...brands, brand] : brands }
    ])
}

/** True when the type is on the list. */
export function hasPaymentType(options: readonly PaymentOption[], paymentType: PaymentType): boolean {
    return options.some(option => option.paymentType === paymentType)
}

/** True when the brand is listed under the type. */
export function hasPaymentBrand(
    options: readonly PaymentOption[],
    paymentType: PaymentType,
    brand: PaymentBrand
): boolean {
    return options.some(option => option.paymentType === paymentType && (option.paymentBrands ?? []).includes(brand))
}

/** The brands a type can name in the form. */
export function brandsForPaymentType(paymentType: PaymentType): readonly PaymentBrand[] {
    return PAYMENT_TYPE_BRANDS[paymentType]
}

/** The list the API stores, or null when it matches what was saved. Order does not count. */
export function changedPaymentOptions(
    current: readonly PaymentOption[],
    original: readonly PaymentOption[] | null | undefined
): PaymentOptionsInput[] | null {
    const next = paymentOptionsInput(current)
    const previous = paymentOptionsInput(original ?? [])
    return JSON.stringify(next) === JSON.stringify(previous) ? null : next
}

/** The list in display order, without the GraphQL __typename a read may carry. */
export function paymentOptionsInput(options: readonly PaymentOption[]): PaymentOptionsInput[] {
    return normalizePaymentOptions(options).map(option => ({
        paymentType: option.paymentType,
        paymentBrands: option.paymentBrands ?? []
    }))
}

/**
 * One line for the clinic page, such as "Cash, Credit card (Visa, JCB)".
 * Empty when the list is unknown, so the page shows nothing.
 */
export function formatPaymentOptions(
    options: readonly PaymentOption[] | null | undefined,
    t: Translate
): string {
    return normalizePaymentOptions(options ?? [])
        .map(option => {
            const typeLabel = paymentTypeLabel(option.paymentType, t)
            const brands = (option.paymentBrands ?? [])
                .filter(isPaymentBrand)
                .map(brand => paymentBrandLabel(brand, t))
            return brands.length ? `${typeLabel} (${brands.join(', ')})` : typeLabel
        })
        .join(', ')
}
