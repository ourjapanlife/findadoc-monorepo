import { readFileSync } from 'node:fs'
import { Faker, en, ja } from '@faker-js/faker'
import {
    Degree,
    FacilitySource,
    FacilityVerificationStatus,
    Insurance,
    Locale,
    PaymentType,
    Specialty
} from '@findadoc/graphql'
import { CLINICAL_LICENSES } from '@findadoc/utils'
import { licenseColumnsForDegrees } from '../../src/licenses/professionalLicense.js'
import { prefectureTranslations } from '../../utils/japanesePrefectures.js'
import { showcaseClinicFacility } from './clinicSiteContent.js'
import { validateSeed, type SeedFile } from './schema.js'

const SEED_COUNT = 30
const INDEXABLE_FACET_COUNT = 3

const faker = new Faker({ locale: [en] })
const fakerJa = new Faker({ locale: [ja] })
faker.seed(20261016)
fakerJa.seed(20261016)

const municipalities = JSON.parse(
    readFileSync(new URL('../../src/vocabulary/municipalities.json', import.meta.url), 'utf8')
) as Array<{ prefectureEn: string, nameEn: string, nameJa: string }>

const prefecturePoint: Record<string, [number, number]> = {
    Hokkaido: [43.06, 141.35],
    Aomori: [40.82, 140.74],
    Iwate: [39.70, 141.15],
    Miyagi: [38.27, 140.87],
    Akita: [39.72, 140.10],
    Yamagata: [38.24, 140.36],
    Fukushima: [37.75, 140.47],
    Ibaraki: [36.34, 140.45],
    Tochigi: [36.57, 139.88],
    Gunma: [36.39, 139.06],
    Saitama: [35.86, 139.65],
    Chiba: [35.60, 140.12],
    Tokyo: [35.68, 139.76],
    Kanagawa: [35.45, 139.64],
    Niigata: [37.90, 139.02],
    Toyama: [36.70, 137.21],
    Ishikawa: [36.59, 136.63],
    Fukui: [36.07, 136.22],
    Yamanashi: [35.66, 138.57],
    Nagano: [36.65, 138.18],
    Gifu: [35.39, 136.72],
    Shizuoka: [34.98, 138.38],
    Aichi: [35.18, 136.91],
    Mie: [34.73, 136.51],
    Shiga: [35.00, 135.87],
    Kyoto: [35.02, 135.76],
    Osaka: [34.69, 135.50],
    Hyogo: [34.69, 135.18],
    Nara: [34.69, 135.83],
    Wakayama: [34.23, 135.17],
    Tottori: [35.50, 134.24],
    Shimane: [35.47, 133.05],
    Okayama: [34.66, 133.93],
    Hiroshima: [34.40, 132.46],
    Yamaguchi: [34.19, 131.47],
    Tokushima: [34.07, 134.55],
    Kagawa: [34.34, 134.04],
    Ehime: [33.84, 132.77],
    Kochi: [33.56, 133.53],
    Fukuoka: [33.61, 130.42],
    Saga: [33.25, 130.30],
    Nagasaki: [32.74, 129.87],
    Kumamoto: [32.79, 130.74],
    Oita: [33.24, 131.61],
    Miyazaki: [31.91, 131.42],
    Kagoshima: [31.56, 130.56],
    Okinawa: [26.21, 127.68]
}

const extraLanguages = [
    Locale.KoKr,
    Locale.ZhCn,
    Locale.FrFr,
    Locale.EsEs,
    Locale.DeDe,
    Locale.PtBr,
    Locale.ViVn,
    Locale.ThTh
]

const statuses = ['pending', 'under_review', 'approved', 'rejected'] as const

const paymentSets: Array<SeedFile['facilities'][number]['payment_options']> = [
    [{ paymentType: PaymentType.Cash, paymentBrands: [] }, { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'Mastercard', 'JCB'] }],
    [{ paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'JCB', 'American Express'] }],
    [{ paymentType: PaymentType.Cash, paymentBrands: [] }, { paymentType: PaymentType.ElectronicMoney, paymentBrands: ['Suica', 'Pasmo'] }, { paymentType: PaymentType.QrCode, paymentBrands: ['PayPay'] }],
    [{ paymentType: PaymentType.Insurance, paymentBrands: ['Japanese health insurance'] }, { paymentType: PaymentType.CreditCard, paymentBrands: ['Visa', 'Mastercard'] }]
]

function iso(day: number): string {
    return new Date(Date.UTC(2026, 0, day, 9, 0, 0)).toISOString()
}

function cities(): Array<{ prefectureEn: string, nameEn: string, nameJa: string }> {
    const known = municipalities.filter(city => prefectureTranslations[city.prefectureEn])
    return Array.from({ length: SEED_COUNT }, (_, index) => known[Math.floor(index * known.length / SEED_COUNT)]!)
}

/** Facet pages need three professionals of one specialty in one prefecture. */
function tokyoMinato(): { prefectureEn: string, nameEn: string, nameJa: string } {
    const city = municipalities.find(row => row.prefectureEn === 'Tokyo' && row.nameEn === 'Minato')

    if (!city) {
        throw new Error('Tokyo Minato is missing from the municipality list')
    }

    return city
}

function contact(
    city: { prefectureEn: string, nameEn: string, nameJa: string },
    latitude: number,
    longitude: number,
    index: number
): SeedFile['facilities'][number]['contact'] {
    const prefectureJa = prefectureTranslations[city.prefectureEn]!

    return {
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        email: faker.internet.email().toLowerCase(),
        phone: faker.helpers.fromRegExp(/0[789]0-[0-9]{4}-[0-9]{4}/),
        website: faker.internet.url(),
        address: {
            addressLine1En: faker.location.streetAddress(),
            addressLine2En: faker.location.secondaryAddress(),
            addressLine1Ja: `${city.nameJa}${index + 1}-${(index % 9) + 1}`,
            addressLine2Ja: `${(index % 5) + 1}階`,
            cityEn: city.nameEn,
            cityJa: city.nameJa,
            postalCode: faker.helpers.fromRegExp(/[0-9]{3}-[0-9]{4}/),
            prefectureEn: city.prefectureEn,
            prefectureJa
        }
    }
}

function buildSeed(): SeedFile {
    const selectedCities = cities()
    const facilities: SeedFile['facilities'] = []
    const hps: SeedFile['hps'] = []
    const hpsFacilities: SeedFile['hps_facilities'] = []
    const submissions: SeedFile['submissions'] = []

    for (let index = 0; index < SEED_COUNT; index++) {
        const indexableFacet = index < INDEXABLE_FACET_COUNT
        const city = indexableFacet ? tokyoMinato() : selectedCities[index]!
        const [baseLat, baseLng] = prefecturePoint[city.prefectureEn] ?? [35.68, 139.76]
        const latitude = Number((baseLat + (index % 5) * 0.01).toFixed(4))
        const longitude = Number((baseLng + (index % 4) * 0.01).toFixed(4))
        const facilityId = faker.string.uuid()
        const hpId = faker.string.uuid()
        const created = iso(index + 1)
        const englishName = faker.person.fullName()
        const japaneseFamily = fakerJa.person.lastName()
        const japaneseGiven = fakerJa.person.firstName()
        const license = CLINICAL_LICENSES[index % CLINICAL_LICENSES.length]!
        const degrees = index % 4 === 0 ? [license, Degree.Mph] : [license]
        const licensed = licenseColumnsForDegrees(degrees)
        const specialties = indexableFacet
            ? [Specialty.Dentistry]
            : faker.helpers.arrayElements(Object.values(Specialty), { min: 1, max: 2 })
        const spokenLanguages = indexableFacet
            ? [Locale.EnUs, Locale.JaJp]
            : [Locale.EnUs, Locale.JaJp, extraLanguages[index % extraLanguages.length]!]
        const insurance = index % 5 === 0
            ? [Insurance.InternationalHealthInsurance]
            : [Insurance.JapaneseHealthInsurance]

        facilities.push({
            id: facilityId,
            code: null,
            name_en: `${faker.company.name()} Clinic`,
            name_ja: fakerJa.company.name(),
            contact: contact(city, latitude, longitude, index),
            map_latitude: latitude,
            map_longitude: longitude,
            created_date: created,
            updated_date: created,
            firestore_id: null,
            payment_options: paymentSets[index % paymentSets.length]!,
            city_id: { prefectureEn: city.prefectureEn, nameEn: city.nameEn },
            google_place_id: null,
            source: FacilitySource.Manual,
            verification_status: FacilityVerificationStatus.Confirmed,
            supported_languages: index % 3 === 0 ? [] : [Locale.EnUs, Locale.JaJp]
        })

        hps.push({
            id: hpId,
            names: [
                {
                    firstName: englishName.split(' ')[0] ?? englishName,
                    lastName: englishName.split(' ').slice(1).join(' ') || 'Sato',
                    locale: Locale.EnUs
                },
                {
                    firstName: japaneseGiven,
                    lastName: japaneseFamily,
                    locale: Locale.JaJp
                }
            ],
            additional_info_for_patients: faker.lorem.sentence(),
            degrees: licensed.degrees,
            primary_license: licensed.primaryLicense,
            additional_credentials: licensed.additionalCredentials,
            license_review: licensed.licenseReview,
            license_recommendation: licensed.licenseRecommendation,
            specialties,
            spoken_languages: spokenLanguages,
            accepted_insurance: insurance,
            email: faker.internet.email().toLowerCase(),
            created_date: created,
            updated_date: created,
            firestore_id: null
        })

        hpsFacilities.push({ hps_id: hpId, facilities_id: facilityId })

        const status = statuses[index % statuses.length]!
        const linked = status === 'approved'
        submissions.push({
            id: faker.string.uuid(),
            status,
            created_date: created,
            updated_date: created,
            hps_id: linked ? hpId : null,
            facilities_id: linked ? facilityId : null,
            google_maps_url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
            healthcare_professional_name: `${japaneseFamily} ${japaneseGiven}`,
            spoken_languages: [Locale.EnUs, Locale.JaJp],
            notes: status === 'rejected' ? 'Duplicate of an existing clinic.' : null,
            facility_partial: linked ? null : {
                nameEn: `${faker.company.name()} Clinic`,
                nameJa: fakerJa.company.name(),
                contact: contact(city, latitude, longitude, index),
                mapLatitude: latitude,
                mapLongitude: longitude,
                healthcareProfessionalIds: []
            },
            healthcare_professionals_partial: [{
                names: [
                    { firstName: japaneseGiven, lastName: japaneseFamily, locale: Locale.JaJp },
                    { firstName: englishName.split(' ')[0] ?? englishName, lastName: englishName.split(' ').slice(1).join(' ') || 'Sato', locale: Locale.EnUs }
                ],
                spokenLanguages: [Locale.EnUs, Locale.JaJp],
                degrees: [license],
                specialties,
                acceptedInsurance: insurance,
                additionalInfoForPatients: faker.lorem.sentence(),
                facilityIds: linked ? [facilityId] : []
            }],
            firestore_id: null
        })
    }

    facilities.push(showcaseClinicFacility)

    return { facilities, hps, hps_facilities: hpsFacilities, submissions }
}

export const seedData = buildSeed() satisfies SeedFile

validateSeed(seedData)
