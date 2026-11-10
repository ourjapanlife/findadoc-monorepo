import * as gqlTypes from '@findadoc/graphql'
import { faker, fakerJA } from '@faker-js/faker'
import { normalizePaymentOptions, PAYMENT_TYPE_BRANDS, PAYMENT_TYPES } from '@findadoc/utils'

/**
 * Generates random data for a CreateFacilityInput GraphQL object.
 * This function focuses only on generating the core fields required for the 'facilities' table.
 * The UUID ('id') and relationships (like 'hps_facilities') must be managed by the seeding script.
 * * @returns {gqlTypes.CreateFacilityInput} The core facility data structure.
 */

/** A Places-shaped id that cannot be mistaken for a real one. */
export function fakeGooglePlaceId(): string {
    return `ChIJFake${faker.string.alphanumeric(19)}`
}

export function generateRandomCreateFacilityInput()
: gqlTypes.CreateFacilityInput {
    const fullEnglishName = faker.company.name()
    const email = faker.internet.email({ firstName: fullEnglishName })
    const fullJapaneseName = fakerJA.company.name()

    // Select random location from Tokyo, Kyoto, or Hokkaido
    const locations = [
        {
            cityEn: 'Chiyoda',
            cityJa: '千代田区',
            prefectureEn: 'Tokyo',
            prefectureJa: '東京都',
            latMin: 35.6,
            latMax: 35.8,
            lngMin: 139.3,
            lngMax: 139.9,
            postalCodePattern: /1[0-9]{2}-[0-9]{4}/
        },
        {
            cityEn: 'Kyoto',
            cityJa: '京都市',
            prefectureEn: 'Kyoto',
            prefectureJa: '京都府',
            latMin: 35.0,
            latMax: 35.1,
            lngMin: 135.7,
            lngMax: 135.8,
            postalCodePattern: /6[0-9]{2}-[0-9]{4}/
        },
        {
            cityEn: 'Sapporo',
            cityJa: '札幌市',
            prefectureEn: 'Hokkaido',
            prefectureJa: '北海道',
            latMin: 43.0,
            latMax: 43.1,
            lngMin: 141.3,
            lngMax: 141.4,
            postalCodePattern: /0[0-9]{2}-[0-9]{4}/
        }
    ]

    const selectedLocation = faker.helpers.arrayElement(locations)

    return {
        nameEn: fullEnglishName,
        nameJa: fullJapaneseName,
        mapLatitude: faker.location.latitude({ min: selectedLocation.latMin, max: selectedLocation.latMax }),
        mapLongitude: faker.location.longitude({ min: selectedLocation.lngMin, max: selectedLocation.lngMax }),
        // A clinic with an address needs a place id (#228). Fake ids say so in the token.
        googlePlaceId: fakeGooglePlaceId(),
        contact: {
            googleMapsUrl: faker.internet.url(),
            email: email,
            // Stored phones are E.164 Japanese numbers; a US-style faker number fails validation.
            phone: `+8135${faker.string.numeric(7)}`,
            website: faker.internet.url(),
            address: {
                addressLine1En: faker.location.streetAddress(),
                addressLine2En: faker.location.secondaryAddress(),
                addressLine1Ja: fakerJA.location.streetAddress(),
                addressLine2Ja: fakerJA.location.secondaryAddress(),
                cityEn: selectedLocation.cityEn,
                cityJa: selectedLocation.cityJa,
                postalCode: faker.helpers.fromRegExp(selectedLocation.postalCodePattern),
                prefectureEn: selectedLocation.prefectureEn,
                prefectureJa: selectedLocation.prefectureJa
            }
        },
        paymentOptions: fakePaymentOptions()
    }
}

/** Payment from the controlled list (#20). Some facilities stay unknown, like most real ones. */
function fakePaymentOptions(): gqlTypes.PaymentOptionsInput[] {
    if (faker.datatype.boolean()) {
        return []
    }

    const types = faker.helpers.arrayElements([...PAYMENT_TYPES], { min: 1, max: 3 })

    // Stored lists come back in display order, so fake input uses that order too.
    return normalizePaymentOptions(types.map(paymentType => ({
        paymentType,
        paymentBrands: faker.helpers.arrayElements([...PAYMENT_TYPE_BRANDS[paymentType]])
    })))
}

export function generateRandomCreateFacilityInputArray({ count }: { count: number } = { count: 30 })
: gqlTypes.CreateFacilityInput[] {
    return faker.helpers.multiple(generateRandomCreateFacilityInput, {
        count
    })
}
