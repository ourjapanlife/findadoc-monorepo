import {
    listPrefectureJapanEn,
    listPrefectureJapanJa,
    pairedPrefectureEn,
    pairedPrefectureJa
} from '~/stores/locationsStore'
import { matchOfficialCity, type CityOption } from '~/utils/cityOptions'

export type FacilityMapsFillTarget = {
    nameEn: string
    nameJa: string
    postalCode: string
    prefectureEn: string
    prefectureJa: string
    cityId: string
    cityEn: string
    cityJa: string
    addressLine1En: string
    addressLine1Ja: string
    mapLatitude: string
    mapLongitude: string
}

export type MapsFillSource = {
    nameEn: string | null
    nameJa: string | null
    postalCode: string | null
    prefectureEn: string | null
    prefectureJa: string | null
    cityEn: string | null
    cityJa: string | null
    streetEn: string | null
    streetJa: string | null
    latitude: number | null
    longitude: number | null
}

const JAPANESE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff]/

/**
 * Values to copy into facility fields that are still empty.
 * A field the moderator already typed is left alone.
 * The pin is copied only when both pin fields are empty.
 */
export function fillEmptyFacilityFields(
    current: FacilityMapsFillTarget,
    source: MapsFillSource
): Partial<FacilityMapsFillTarget> {
    const patch: Partial<FacilityMapsFillTarget> = {}
    assignScripted(current.nameEn, source.nameEn, 'nameEn', patch)
    assignScripted(current.nameJa, source.nameJa, 'nameJa', patch)
    assignScripted(current.nameEn, source.nameJa, 'nameEn', patch)
    assignScripted(current.nameJa, source.nameEn, 'nameJa', patch)

    const postal = normalizePostalCode(source.postalCode)
    if (postal && !current.postalCode.trim()) {
        patch.postalCode = postal
    }

    const prefectureJa = officialPrefecture(source.prefectureJa, listPrefectureJapanJa)
    const prefectureEn = officialPrefecture(source.prefectureEn, listPrefectureJapanEn)
    if (!current.prefectureJa.trim()) {
        const nextJa = prefectureJa || pairedPrefectureJa(prefectureEn ?? '')
        if (nextJa) {
            patch.prefectureJa = nextJa
        }
    }
    if (!current.prefectureEn.trim()) {
        const nextEn = prefectureEn || pairedPrefectureEn(patch.prefectureJa ?? prefectureJa ?? '')
        if (nextEn) {
            patch.prefectureEn = nextEn
        }
    }

    if (!cityIsSet(current)) {
        assignScripted(current.cityEn, source.cityEn, 'cityEn', patch)
        assignScripted(current.cityJa, source.cityJa, 'cityJa', patch)
        assignScripted(current.cityEn, source.cityJa, 'cityEn', patch)
        assignScripted(current.cityJa, source.cityEn, 'cityJa', patch)
    }

    assignStreet(current.addressLine1En, source.streetEn, 'addressLine1En', patch)
    assignStreet(current.addressLine1Ja, source.streetJa, 'addressLine1Ja', patch)
    assignStreet(current.addressLine1En, source.streetJa, 'addressLine1En', patch)
    assignStreet(current.addressLine1Ja, source.streetEn, 'addressLine1Ja', patch)

    if (!current.mapLatitude.trim() && !current.mapLongitude.trim() && usablePin(source)) {
        patch.mapLatitude = String(source.latitude)
        patch.mapLongitude = String(source.longitude)
    }

    return patch
}

const SINGLE_FIELDS = [
    'nameEn',
    'nameJa',
    'postalCode',
    'prefectureEn',
    'prefectureJa',
    'addressLine1En',
    'addressLine1Ja'
] as const

/**
 * Drop patch keys the moderator filled while a lookup was in flight.
 * City is one value, and the pin is one value, so a later edit to either side removes both keys.
 */
export function withoutFilledFields(
    current: FacilityMapsFillTarget,
    patch: Partial<FacilityMapsFillTarget>
): Partial<FacilityMapsFillTarget> {
    const next: Partial<FacilityMapsFillTarget> = {}

    for (const key of SINGLE_FIELDS) {
        const value = patch[key]
        if (value !== undefined && current[key].trim() === '') {
            next[key] = value
        }
    }

    if (!cityIsSet(current)) {
        if (patch.cityId !== undefined) next.cityId = patch.cityId
        if (patch.cityEn !== undefined) next.cityEn = patch.cityEn
        if (patch.cityJa !== undefined) next.cityJa = patch.cityJa
    }

    if (current.mapLatitude.trim() === '' && current.mapLongitude.trim() === '') {
        if (patch.mapLatitude !== undefined) next.mapLatitude = patch.mapLatitude
        if (patch.mapLongitude !== undefined) next.mapLongitude = patch.mapLongitude
    }

    return next
}

/** Replace a Places city spelling with the official municipality when one row matches. */
export function officialCityPatch(
    current: FacilityMapsFillTarget,
    patch: Partial<FacilityMapsFillTarget>,
    cities: readonly CityOption[]
): Partial<FacilityMapsFillTarget> {
    if (cityIsSet(current) || (!patch.cityEn && !patch.cityJa)) {
        return patch
    }

    const prefectureEn = patch.prefectureEn ?? current.prefectureEn
    const match = matchOfficialCity(cities, prefectureEn, patch.cityEn, patch.cityJa)
    if (!match) {
        return patch
    }

    return {
        ...patch,
        cityId: match.id,
        cityEn: match.nameEn,
        cityJa: match.nameJa
    }
}

export function normalizePostalCode(value: string | null): string | null {
    if (value === null) {
        return null
    }
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 7) {
        return null
    }
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
}

function cityIsSet(current: FacilityMapsFillTarget): boolean {
    return Boolean(current.cityId.trim() || current.cityEn.trim() || current.cityJa.trim())
}

function assignScripted(
    current: string,
    incoming: string | null,
    key: 'nameEn' | 'nameJa' | 'cityEn' | 'cityJa',
    patch: Partial<FacilityMapsFillTarget>
) {
    const value = incoming?.trim() ?? ''
    if (!value || current.trim() || patch[key]) {
        return
    }
    const japanese = JAPANESE_SCRIPT.test(value)
    if ((key === 'nameJa' || key === 'cityJa') && japanese) {
        patch[key] = value
        return
    }
    if ((key === 'nameEn' || key === 'cityEn') && !japanese && /[A-Za-z]/.test(value)) {
        patch[key] = value
    }
}

function assignStreet(
    current: string,
    incoming: string | null,
    key: 'addressLine1En' | 'addressLine1Ja',
    patch: Partial<FacilityMapsFillTarget>
) {
    const value = incoming?.trim() ?? ''
    if (!value || current.trim() || patch[key]) {
        return
    }
    const japanese = JAPANESE_SCRIPT.test(value)
    if (key === 'addressLine1Ja' && (japanese || !/[A-Za-z]/.test(value))) {
        patch.addressLine1Ja = value
        return
    }
    if (key === 'addressLine1En' && !japanese) {
        patch.addressLine1En = value
    }
}

function officialPrefecture(value: string | null, names: readonly string[]): string | null {
    const text = value?.trim() ?? ''
    if (!text) {
        return null
    }
    if (names.includes(text)) {
        return text
    }
    return longestContained(text, names)
}

function longestContained(address: string, names: readonly string[]): string | null {
    const hits = names.filter(name => address.includes(name))
    hits.sort((left, right) => right.length - left.length)
    return hits[0] ?? null
}

function usablePin(source: MapsFillSource): source is MapsFillSource & { latitude: number, longitude: number } {
    const { latitude, longitude } = source
    if (latitude === null || longitude === null) {
        return false
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false
    }
    return !(latitude === 0 && longitude === 0)
}
