import { PaymentType, type PaymentOption, type PaymentOptionsInput } from '@findadoc/graphql'

/**
 * Payment on a facility (#20). An empty list is unknown, not cash only, and shows nothing.
 * A list only holds what a moderator confirmed with the clinic.
 */

/** Controlled brand list from the approved data-cleaning plan. Suica and PASMO share IC. */
export const PAYMENT_BRANDS = [
    'Visa',
    'Mastercard',
    'American Express',
    'JCB',
    'Diners Club',
    'UnionPay',
    'IC',
    'PayPay',
    'Other'
] as const

export type PaymentBrand = typeof PAYMENT_BRANDS[number]

/** Payment types in the order the forms and clinic page show them. */
export const PAYMENT_TYPES: readonly PaymentType[] = [
    PaymentType.Cash,
    PaymentType.CreditCard,
    PaymentType.DebitCard,
    PaymentType.ElectronicMoney,
    PaymentType.QrCode
]

const CARD_BRANDS: readonly PaymentBrand[] = [
    'Visa',
    'Mastercard',
    'American Express',
    'JCB',
    'Diners Club',
    'UnionPay',
    'Other'
]

/** The brands each type may name, in display order. Cash names none. */
export const PAYMENT_TYPE_BRANDS: Readonly<Record<PaymentType, readonly PaymentBrand[]>> = {
    [PaymentType.Cash]: [],
    [PaymentType.CreditCard]: CARD_BRANDS,
    [PaymentType.DebitCard]: CARD_BRANDS,
    [PaymentType.ElectronicMoney]: ['IC', 'Other'],
    [PaymentType.QrCode]: ['PayPay', 'Other']
}

export function isPaymentType(value: unknown): value is PaymentType {
    return typeof value === 'string' && (PAYMENT_TYPES as readonly string[]).includes(value)
}

export function isPaymentBrand(value: unknown): value is PaymentBrand {
    return typeof value === 'string' && (PAYMENT_BRANDS as readonly string[]).includes(value)
}

export type PaymentOptionsProblem =
    | 'too_many'
    | 'unknown_type'
    | 'duplicate_type'
    | 'unknown_brand'
    | 'duplicate_brand'

/**
 * Why a payment list from a form or the API cannot be saved, or null when it can.
 * Each type appears once, and each brand is on the controlled list for its type.
 */
export function paymentOptionsProblem(options: readonly PaymentOptionsInput[]): PaymentOptionsProblem | null {
    if (options.length > PAYMENT_TYPES.length) {
        return 'too_many'
    }

    const seenTypes = new Set<string>()

    for (const option of options) {
        if (!isPaymentType(option.paymentType)) {
            return 'unknown_type'
        }
        if (seenTypes.has(option.paymentType)) {
            return 'duplicate_type'
        }
        seenTypes.add(option.paymentType)

        const allowed = PAYMENT_TYPE_BRANDS[option.paymentType]
        const brands = option.paymentBrands ?? []

        if (brands.some(brand => !(allowed as readonly string[]).includes(brand))) {
            return 'unknown_brand'
        }
        if (new Set(brands).size !== brands.length) {
            return 'duplicate_brand'
        }
    }

    return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The stored or submitted list in display order, with only known types and the brands each
 * type allows. A legacy entry (an old type, a free-text brand) is dropped rather than shown.
 */
export function normalizePaymentOptions(value: unknown): PaymentOption[] {
    if (!Array.isArray(value)) {
        return []
    }

    const brandsByType = new Map<PaymentType, Set<string>>()

    for (const entry of value) {
        if (!isRecord(entry) || !isPaymentType(entry.paymentType)) {
            continue
        }
        const brands = brandsByType.get(entry.paymentType) ?? new Set<string>()
        if (Array.isArray(entry.paymentBrands)) {
            entry.paymentBrands.forEach(brand => {
                if (typeof brand === 'string') {
                    brands.add(brand)
                }
            })
        }
        brandsByType.set(entry.paymentType, brands)
    }

    return PAYMENT_TYPES
        .filter(type => brandsByType.has(type))
        .map(type => ({
            paymentType: type,
            paymentBrands: PAYMENT_TYPE_BRANDS[type].filter(brand => brandsByType.get(type)?.has(brand) === true)
        }))
}
