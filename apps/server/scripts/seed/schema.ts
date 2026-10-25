import { readFileSync } from 'node:fs'
import type { ColumnType } from 'kysely'
import {
    Degree,
    FacilitySource,
    FacilityVerificationStatus,
    Insurance,
    LicenseReviewStatus,
    Locale,
    PaymentType,
    Specialty,
    type ContactInput
} from '@findadoc/graphql'
import type {
    FacilitiesTable,
    HpsFacilitiesTable,
    HpsTable,
    SubmissionStatusEnum,
    SubmissionsTable
} from '../../src/typeDefs/kyselyTypes.js'
const municipalities = JSON.parse(
    readFileSync(new URL('../../src/vocabulary/municipalities.json', import.meta.url), 'utf8')
) as Array<{ prefectureEn: string, nameEn: string, nameJa: string }>

/** String values of a string enum, so committed JSON can satisfy the schema. */
export type EnumValue<T extends string> = `${T}`

type InsertTypeOf<T> = T extends ColumnType<unknown, infer Insert, unknown> ? Insert : T

/** Columns a seed row must name. Generated columns are omitted. */
type RequiredKeys<T> = {
    [K in keyof T]-?: undefined extends InsertTypeOf<T[K]>
        ? never
        : [InsertTypeOf<T[K]>] extends [never]
            ? never
            : K
}[keyof T]

type Expect<T extends true> = T
type Covers<Required, Seed> = Exclude<Required, keyof Seed> extends never ? true : false

export type CityRef = {
    prefectureEn: string
    nameEn: string
}

export type PaymentOptionSeed = {
    paymentType: EnumValue<PaymentType>
    paymentBrands?: string[] | null
}

export type LocalizedNameSeed = {
    firstName: string
    lastName: string
    middleName?: string | null
    locale: EnumValue<Locale>
}

export type FacilitySeed = {
    id: string
    code: string | null
    name_en: string
    name_ja: string
    contact: ContactInput
    map_latitude: number
    map_longitude: number
    created_date: string
    updated_date: string
    firestore_id: string | null
    payment_options: PaymentOptionSeed[] | null
    city_id: CityRef | null
    google_place_id: string | null
    source: EnumValue<FacilitySource> | null
    verification_status: EnumValue<FacilityVerificationStatus>
    supported_languages: EnumValue<Locale>[]
}

export type HpSeed = {
    id: string
    names: LocalizedNameSeed[]
    additional_info_for_patients: string | null
    degrees: EnumValue<Degree>[]
    primary_license: EnumValue<Degree> | null
    additional_credentials: EnumValue<Degree>[]
    license_review: EnumValue<LicenseReviewStatus> | null
    license_recommendation: string | null
    specialties: EnumValue<Specialty>[]
    spoken_languages: EnumValue<Locale>[]
    accepted_insurance: EnumValue<Insurance>[]
    email: string | null
    created_date: string
    updated_date: string
    firestore_id: string | null
}

export type HpSubmissionSeed = {
    names: LocalizedNameSeed[]
    spokenLanguages: EnumValue<Locale>[]
    degrees?: EnumValue<Degree>[] | null
    specialties?: EnumValue<Specialty>[] | null
    acceptedInsurance?: EnumValue<Insurance>[] | null
    additionalInfoForPatients?: string | null
    facilityIds: string[]
}

export type FacilitySubmissionSeed = {
    nameEn?: string | null
    nameJa?: string | null
    contact?: ContactInput | null
    mapLatitude?: number | null
    mapLongitude?: number | null
    healthcareProfessionalIds: string[]
}

export type SubmissionSeed = {
    id: string
    status: SubmissionStatusEnum
    created_date: string
    updated_date: string
    hps_id: string | null
    facilities_id: string | null
    google_maps_url: string | null
    healthcare_professional_name: string | null
    spoken_languages: EnumValue<Locale>[] | null
    notes: string | null
    facility_partial: FacilitySubmissionSeed | null
    healthcare_professionals_partial: HpSubmissionSeed[] | null
    firestore_id: string | null
}

export type RelationSeed = {
    hps_id: string
    facilities_id: string
}

export type SeedFile = {
    facilities: FacilitySeed[]
    hps: HpSeed[]
    hps_facilities: RelationSeed[]
    submissions: SubmissionSeed[]
}

export type FacilitySeedCoversTable = Expect<Covers<RequiredKeys<FacilitiesTable>, FacilitySeed>>
export type HpSeedCoversTable = Expect<Covers<RequiredKeys<HpsTable>, HpSeed>>
export type SubmissionSeedCoversTable = Expect<Covers<RequiredKeys<SubmissionsTable>, SubmissionSeed>>
export type RelationSeedCoversTable = Expect<Covers<RequiredKeys<HpsFacilitiesTable>, RelationSeed>>

const municipalitiesByKey = new Map(
    municipalities.map(city => [`${city.prefectureEn}|${city.nameEn}`, city])
)

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function enumValues<T extends Record<string, string>>(enumObject: T): Set<string> {
    return new Set(Object.values(enumObject))
}

const degreeValues = enumValues(Degree)
const specialtyValues = enumValues(Specialty)
const localeValues = enumValues(Locale)
const insuranceValues = enumValues(Insurance)
const paymentTypeValues = enumValues(PaymentType)
const verificationValues = enumValues(FacilityVerificationStatus)
const sourceValues = enumValues(FacilitySource)
const licenseReviewValues = enumValues(LicenseReviewStatus)
const submissionStatuses = new Set<SubmissionStatusEnum>(['pending', 'under_review', 'approved', 'rejected'])

function readEnum<T extends string>(
    value: unknown,
    allowed: Set<string>,
    label: string,
    problems: string[]
): T | null {
    if (value === null || value === undefined) {
        return null
    }

    if (typeof value === 'string' && allowed.has(value)) {
        return value as T
    }

    problems.push(`${label} has ${JSON.stringify(value)}, which is not in the schema`)
    return null
}

function readEnumList(
    value: unknown,
    allowed: Set<string>,
    label: string,
    problems: string[]
): string[] {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !allowed.has(item))) {
        problems.push(`${label} is not a list of schema values`)
        return []
    }

    return value as string[]
}

export function parseSeed(value: unknown): SeedFile {
    const problems: string[] = []

    if (!isRecord(value) || !Array.isArray(value.facilities) || !Array.isArray(value.hps) || !Array.isArray(value.hps_facilities) || !Array.isArray(value.submissions)) {
        throw new Error('Seed data does not fit the schema: expected facilities, hps, hps_facilities, and submissions')
    }

    for (const facility of value.facilities) {
        if (!isRecord(facility)) {
            problems.push('A facility row is not an object')
            continue
        }

        readEnum(facility.verification_status, verificationValues, `${facility.id} verification_status`, problems)
        readEnum(facility.source, sourceValues, `${facility.id} source`, problems)
        readEnumList(facility.supported_languages, localeValues, `${facility.id} supported_languages`, problems)

        if (!Array.isArray(facility.payment_options)) {
            problems.push(`${facility.id} payment_options is missing`)
        } else {
            facility.payment_options.forEach((option, index) => {
                if (!isRecord(option)) {
                    problems.push(`${facility.id} payment option ${index} is not an object`)
                    return
                }

                readEnum(option.paymentType, paymentTypeValues, `${facility.id} payment option ${index}`, problems)
            })
        }
    }

    for (const hp of value.hps) {
        if (!isRecord(hp)) {
            problems.push('A professional row is not an object')
            continue
        }

        readEnumList(hp.degrees, degreeValues, `${hp.id} degrees`, problems)
        readEnum(hp.primary_license, degreeValues, `${hp.id} primary_license`, problems)
        readEnumList(hp.additional_credentials, degreeValues, `${hp.id} additional_credentials`, problems)
        readEnum(hp.license_review, licenseReviewValues, `${hp.id} license_review`, problems)
        readEnumList(hp.specialties, specialtyValues, `${hp.id} specialties`, problems)
        readEnumList(hp.spoken_languages, localeValues, `${hp.id} spoken_languages`, problems)
        readEnumList(hp.accepted_insurance, insuranceValues, `${hp.id} accepted_insurance`, problems)

        if (!Array.isArray(hp.names)) {
            problems.push(`${hp.id} names is missing`)
        } else {
            hp.names.forEach((name, index) => {
                if (!isRecord(name)) {
                    problems.push(`${hp.id} name ${index} is not an object`)
                    return
                }

                readEnum(name.locale, localeValues, `${hp.id} name ${index} locale`, problems)
            })
        }
    }

    for (const submission of value.submissions) {
        if (!isRecord(submission)) {
            problems.push('A submission row is not an object')
            continue
        }

        readEnum(submission.status, submissionStatuses, `${submission.id} status`, problems)
        readEnumList(submission.spoken_languages, localeValues, `${submission.id} spoken_languages`, problems)

        if (Array.isArray(submission.healthcare_professionals_partial)) {
            submission.healthcare_professionals_partial.forEach((hp, index) => {
                if (!isRecord(hp)) {
                    problems.push(`${submission.id} professional ${index} is not an object`)
                    return
                }

                readEnumList(hp.degrees, degreeValues, `${submission.id} professional ${index} degrees`, problems)
                readEnumList(hp.specialties, specialtyValues, `${submission.id} professional ${index} specialties`, problems)
                readEnumList(hp.spokenLanguages, localeValues, `${submission.id} professional ${index} spokenLanguages`, problems)
                readEnumList(hp.acceptedInsurance, insuranceValues, `${submission.id} professional ${index} acceptedInsurance`, problems)
            })
        }
    }

    const seed = value as SeedFile
    validateSeed(seed, problems)

    if (problems.length) {
        throw new Error(`Seed data does not fit the schema:\n${problems.join('\n')}`)
    }

    return seed
}

export function validateSeed(seed: SeedFile, problems: string[] = []): void {
    const facilityIds = new Set(seed.facilities.map(facility => facility.id))
    const hpIds = new Set(seed.hps.map(hp => hp.id))

    for (const facility of seed.facilities) {
        const address = facility.contact.address

        if (facility.verification_status === 'CONFIRMED') {
            if (!facility.city_id) {
                problems.push(`${facility.id} is CONFIRMED without a city`)
                continue
            }

            const city = municipalitiesByKey.get(`${facility.city_id.prefectureEn}|${facility.city_id.nameEn}`)

            if (!city) {
                problems.push(`${facility.id} city ${facility.city_id.prefectureEn}/${facility.city_id.nameEn} is not in the municipality list`)
                continue
            }

            if (
                address === undefined
                || address === null
                || address.prefectureEn !== city.prefectureEn
                || address.cityEn !== city.nameEn
                || address.cityJa !== city.nameJa
            ) {
                problems.push(`${facility.id} address does not match ${city.prefectureEn}/${city.nameEn}`)
            }
        }

        if (facility.verification_status === 'UNVERIFIED_LOCATION' && facility.city_id) {
            problems.push(`${facility.id} is UNVERIFIED_LOCATION and also has a city`)
        }
    }

    for (const hp of seed.hps) {
        if (hp.primary_license && !hp.degrees.includes(hp.primary_license)) {
            problems.push(`${hp.id} primary license ${hp.primary_license} is not one of its degrees`)
        }
    }

    for (const relation of seed.hps_facilities) {
        if (!hpIds.has(relation.hps_id) || !facilityIds.has(relation.facilities_id)) {
            problems.push(`Relation ${relation.hps_id} -> ${relation.facilities_id} points at a missing row`)
        }
    }

    if (problems.length) {
        throw new Error(`Seed data does not fit the schema:\n${problems.join('\n')}`)
    }
}
