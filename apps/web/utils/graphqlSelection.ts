import type {
    City,
    Contact,
    Facility,
    FacilitySubmission,
    HealthcareProfessional,
    HealthcareProfessionalSubmission,
    LocalizedName,
    PaymentOption,
    PhysicalAddress,
    Prefecture,
    Submission
} from '@findadoc/graphql'

/** GraphQL output fields. `__typename` is codegen metadata, not a schema field. */
type SchemaField<T> = Exclude<keyof T, '__typename'>

/**
 * Every field of T. A new schema field fails typecheck until this selection names it.
 * `true` selects the scalar. A string is the nested selection, including the field name.
 */
type FieldSelection<T> = { [K in SchemaField<T>]-?: string | true }

function selection<T>(fields: FieldSelection<T>): string {
    return Object.entries(fields).map(([name, value]) => (value === true ? name : value)).join('\n')
}

function block(field: string, inner: string): string {
    return `${field} {\n${inner}\n}`
}

const addressSelection = selection<PhysicalAddress>({
    addressLine1En: true,
    addressLine1Ja: true,
    addressLine2En: true,
    addressLine2Ja: true,
    cityEn: true,
    cityJa: true,
    postalCode: true,
    prefectureEn: true,
    prefectureJa: true
})

const contactSelection = selection<Contact>({
    address: block('address', addressSelection),
    email: true,
    googleMapsUrl: true,
    phone: true,
    website: true
})

const nameSelection = selection<LocalizedName>({
    firstName: true,
    lastName: true,
    locale: true,
    middleName: true
})

const paymentOptionSelection = selection<PaymentOption>({
    paymentBrands: true,
    paymentType: true
})

const prefectureSelection = selection<Prefecture>({
    id: true,
    nameEn: true,
    nameJa: true,
    slug: true
})

const citySelection = selection<City>({
    googlePlaceId: true,
    id: true,
    localGovernmentCode: true,
    nameEn: true,
    nameJa: true,
    prefecture: block('prefecture', prefectureSelection),
    slug: true
})

/** Every Facility field. Read queries use this so a schema change cannot leave a query behind. */
export const facilitySelection = selection<Facility>({
    city: block('city', citySelection),
    cityId: true,
    contact: block('contact', contactSelection),
    createdDate: true,
    googlePlaceId: true,
    healthcareProfessionalIds: true,
    id: true,
    mapLatitude: true,
    mapLongitude: true,
    nameEn: true,
    nameJa: true,
    paymentOptions: block('paymentOptions', paymentOptionSelection),
    source: true,
    supportedLanguages: true,
    updatedDate: true,
    verificationStatus: true
})

/** Every HealthcareProfessional field. */
export const professionalSelection = selection<HealthcareProfessional>({
    acceptedInsurance: true,
    additionalCredentials: true,
    additionalInfoForPatients: true,
    createdDate: true,
    degrees: true,
    facilityIds: true,
    id: true,
    licenseRecommendation: true,
    licenseReview: true,
    names: block('names', nameSelection),
    primaryLicense: true,
    specialties: true,
    spokenLanguages: true,
    updatedDate: true
})

export const facilitySubmissionSelection = selection<FacilitySubmission>({
    contact: block('contact', contactSelection),
    healthcareProfessionalIds: true,
    id: true,
    mapLatitude: true,
    mapLongitude: true,
    nameEn: true,
    nameJa: true
})

export const professionalSubmissionSelection = selection<HealthcareProfessionalSubmission>({
    acceptedInsurance: true,
    additionalInfoForPatients: true,
    degrees: true,
    facilityIds: true,
    id: true,
    names: block('names', nameSelection),
    specialties: true,
    spokenLanguages: true
})

export const submissionSelection = selection<Submission>({
    createdDate: true,
    facility: block('facility', facilitySubmissionSelection),
    googleMapsUrl: true,
    healthcareProfessionalName: true,
    healthcareProfessionals: block('healthcareProfessionals', professionalSubmissionSelection),
    id: true,
    isApproved: true,
    isRejected: true,
    isUnderReview: true,
    notes: true,
    spokenLanguages: true,
    updatedDate: true
})
