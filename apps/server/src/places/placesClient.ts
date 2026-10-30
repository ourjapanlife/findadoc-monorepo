const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const AUTOCOMPLETE_FIELD_MASK = [
    'suggestions.placePrediction.placeId',
    'suggestions.placePrediction.text.text',
    'suggestions.placePrediction.structuredFormat.mainText.text',
    'suggestions.placePrediction.structuredFormat.secondaryText.text'
].join(',')
const PLACE_ID_FIELD_MASK = 'id'
const PLACE_MATCH_FIELD_MASK = 'addressComponents,formattedAddress,types'
const PLACE_DETAIL_FIELDS = [
    'id',
    'displayName',
    'formattedAddress',
    'primaryTypeDisplayName',
    'location',
    'addressComponents.longText',
    'addressComponents.shortText',
    'addressComponents.types'
]
const PLACE_PREVIEW_FIELD_MASK = PLACE_DETAIL_FIELDS.join(',')
const PLACE_SEARCH_FIELD_MASK = PLACE_DETAIL_FIELDS.map(field => `places.${field}`).join(',')
const PLACE_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const CITY_COMPONENT_TYPES = ['sublocality_level_1', 'administrative_area_level_3', 'locality'] as const
const STREET_COMPONENT_TYPES = [
    'sublocality_level_1',
    'sublocality_level_2',
    'sublocality_level_3',
    'sublocality_level_4',
    'sublocality_level_5',
    'route',
    'street_number',
    'premise',
    'subpremise'
] as const
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000

export type PlacesPrediction = {
    placeId: string
    label: string
    mainText: string
    secondaryText: string
}

export type PlaceIdCheck = 'confirmed' | 'missing' | 'unavailable'

/** Live place details for an open form. Do not store this. */
export type PlacePreview = {
    placeId: string | null
    name: string | null
    address: string | null
    category: string | null
    postalCode: string | null
    prefecture: string | null
    city: string | null
    street: string | null
    latitude: number | null
    longitude: number | null
}

type AddressComponent = {
    longText: string
    types: string[]
}

/** Text used to match a place onto a city. It is not stored. */
export type PlaceMatchText = {
    mainText: string
    secondaryText: string
}

export type PlaceMatchCheck = PlaceMatchText | 'missing' | 'unavailable'

/** A stored place id with no check time, or a check older than 12 months, needs a refresh. */
export function placeIdIsStale(checkedAt: string | null | undefined, now = Date.now()): boolean {
    if (!checkedAt) { return true }

    const checked = Date.parse(checkedAt)
    if (Number.isNaN(checked)) { return true }

    return now - checked > TWELVE_MONTHS_MS
}

export function normalizePlaceId(value: string): string | null {
    const trimmed = value.trim().replace(/^places\//, '')
    if (!/^[A-Za-z0-9_-]{8,}$/.test(trimmed)) { return null }
    return trimmed
}

export function parseAutocomplete(body: unknown): PlacesPrediction[] {
    if (!body || typeof body !== 'object' || !('suggestions' in body)) { return [] }

    const suggestions = (body as { suggestions?: unknown }).suggestions
    if (!Array.isArray(suggestions)) { return [] }

    const predictions: PlacesPrediction[] = []
    for (const suggestion of suggestions) {
        if (!suggestion || typeof suggestion !== 'object' || !('placePrediction' in suggestion)) { continue }
        const prediction = (suggestion as { placePrediction?: unknown }).placePrediction
        if (!prediction || typeof prediction !== 'object') { continue }

        const record = prediction as {
            placeId?: unknown
            text?: { text?: unknown }
            structuredFormat?: {
                mainText?: { text?: unknown }
                secondaryText?: { text?: unknown }
            }
        }
        const placeId = typeof record.placeId === 'string' ? normalizePlaceId(record.placeId) : null
        const mainText = textOf(record.structuredFormat?.mainText?.text) || textOf(record.text?.text)
        if (!placeId || !mainText) { continue }

        const secondaryText = textOf(record.structuredFormat?.secondaryText?.text)
        const label = secondaryText ? `${mainText}, ${secondaryText}` : mainText
        predictions.push({ placeId, label, mainText, secondaryText })
    }

    return predictions
}

export function parsePlaceDetailsId(body: unknown): string | null {
    if (!body || typeof body !== 'object' || !('id' in body)) { return null }
    const id = (body as { id?: unknown }).id
    return typeof id === 'string' ? normalizePlaceId(id) : null
}

/** Read the city name and the address around it. Both are discarded after matching. */
export function parsePlaceMatchText(body: unknown): PlaceMatchText | null {
    if (!body || typeof body !== 'object') { return null }

    const record = body as {
        formattedAddress?: unknown
        types?: unknown
        addressComponents?: unknown
    }
    if (!Array.isArray(record.addressComponents)) { return null }

    const components = record.addressComponents.flatMap(component => {
        if (!component || typeof component !== 'object') { return [] }
        const item = component as { longText?: unknown, types?: unknown }
        const longText = textOf(item.longText)
        const types = Array.isArray(item.types)
            ? item.types.filter((type): type is string => typeof type === 'string')
            : []
        if (!longText) { return [] }
        return [{ longText, types }]
    })
    const placeTypes = Array.isArray(record.types)
        ? record.types.filter((type): type is string => typeof type === 'string')
        : []
    const preferred = CITY_COMPONENT_TYPES.find(type => placeTypes.includes(type))
        ?? CITY_COMPONENT_TYPES.find(type => components.some(component => component.types.includes(type)))
    const main = preferred
        ? components.find(component => component.types.includes(preferred))
        : undefined
    if (!main) { return null }

    const formatted = textOf(record.formattedAddress)
    const secondary = formatted || components
        .map(component => component.longText)
        .filter(text => text !== main.longText)
        .join(', ')

    return { mainText: main.longText, secondaryText: secondary }
}

export async function autocompleteCities(
    input: string,
    apiKey: string,
    fetchImpl: typeof fetch = fetch
): Promise<PlacesPrediction[]> {
    const response = await fetchImpl(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': AUTOCOMPLETE_FIELD_MASK
        },
        body: JSON.stringify({
            input,
            includedRegionCodes: ['jp'],
            includedPrimaryTypes: ['locality', 'administrative_area_level_3', 'sublocality_level_1'],
            languageCode: 'ja'
        })
    })

    if (!response.ok) {
        throw new Error(`Places autocomplete failed (${response.status})`)
    }

    return parseAutocomplete(await response.json())
}

/** Confirm a place id still exists. Asks only for the id, which is the unbilled refresh. */
export async function confirmPlaceId(
    placeId: string,
    apiKey: string,
    fetchImpl: typeof fetch = fetch
): Promise<PlaceIdCheck> {
    const response = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_ID_FIELD_MASK
        }
    })

    if (response.status === 404) { return 'missing' }
    if (!response.ok) { return 'unavailable' }

    return parsePlaceDetailsId(await response.json()) ? 'confirmed' : 'unavailable'
}

/**
 * Read enough of a place to match it to a city. A 404 means the id is gone.
 * The name and address are for that comparison and are not persisted.
 */
export async function loadPlaceMatch(
    placeId: string,
    apiKey: string,
    fetchImpl: typeof fetch = fetch
): Promise<PlaceMatchCheck> {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
    url.searchParams.set('languageCode', 'ja')

    const response = await fetchImpl(url, {
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_MATCH_FIELD_MASK
        }
    })

    if (response.status === 404) { return 'missing' }
    if (!response.ok) { return 'unavailable' }

    return parsePlaceMatchText(await response.json()) ?? 'unavailable'
}

/** Place Details for a known id. The result is for the open form and is not stored. */
export async function loadPlacePreview(
    placeId: string,
    apiKey: string,
    languageCode: string,
    fetchImpl: typeof fetch = fetch
): Promise<PlacePreview | null> {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
    url.searchParams.set('languageCode', languageCode)

    const response = await fetchImpl(url, {
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_PREVIEW_FIELD_MASK
        }
    })

    if (response.status === 404) { return null }
    if (!response.ok) {
        throw new Error(`Places details failed (${response.status})`)
    }

    return readPlacePreview(await response.json())
}

/**
 * Find the place named in a Maps URL, biased to its pin.
 * The result is for the open form and is not stored.
 */
export async function searchPlacePreview(
    name: string,
    latitude: number | null,
    longitude: number | null,
    apiKey: string,
    languageCode: string,
    fetchImpl: typeof fetch = fetch
): Promise<PlacePreview | null> {
    const body: Record<string, unknown> = {
        textQuery: name,
        languageCode,
        regionCode: 'JP',
        maxResultCount: 1
    }
    if (latitude !== null && longitude !== null) {
        body.locationBias = {
            circle: {
                center: { latitude, longitude },
                radius: 500
            }
        }
    }

    const response = await fetchImpl(PLACE_SEARCH_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_SEARCH_FIELD_MASK
        },
        body: JSON.stringify(body)
    })

    if (!response.ok) {
        throw new Error(`Places search failed (${response.status})`)
    }

    const payload = await response.json() as { places?: unknown }
    const first = Array.isArray(payload.places) ? payload.places[0] : null
    return readPlacePreview(first)
}

/** Up to five live matches. The caller discards the text after the screen closes. */
export async function searchPlaceCandidates(
    name: string,
    latitude: number | null,
    longitude: number | null,
    apiKey: string,
    languageCode: string,
    fetchImpl: typeof fetch = fetch
): Promise<PlacePreview[]> {
    const body: Record<string, unknown> = {
        textQuery: name,
        languageCode,
        regionCode: 'JP',
        maxResultCount: 5
    }
    if (latitude !== null && longitude !== null) {
        body.locationBias = {
            circle: {
                center: { latitude, longitude },
                radius: 500
            }
        }
    }

    const response = await fetchImpl(PLACE_SEARCH_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_SEARCH_FIELD_MASK
        },
        body: JSON.stringify(body)
    })

    if (!response.ok) {
        throw new Error(`Places search failed (${response.status})`)
    }

    const payload = await response.json() as { places?: unknown }
    if (!Array.isArray(payload.places)) { return [] }
    return payload.places.flatMap(place => {
        const preview = readPlacePreview(place)
        return preview?.placeId ? [preview] : []
    })
}

export function readPlacePreview(body: unknown): PlacePreview | null {
    if (!body || typeof body !== 'object') { return null }

    const place = body as {
        id?: unknown
        displayName?: { text?: unknown }
        formattedAddress?: unknown
        primaryTypeDisplayName?: { text?: unknown }
        location?: { latitude?: unknown, longitude?: unknown }
        addressComponents?: unknown
    }
    const name = textOf(place.displayName?.text)
    const address = textOf(place.formattedAddress)
    const category = textOf(place.primaryTypeDisplayName?.text)
    const placeId = typeof place.id === 'string' ? normalizePlaceId(place.id) : null
    const parts = readAddressParts(place.addressComponents)
    const latitude = coordinate(place.location?.latitude)
    const longitude = coordinate(place.location?.longitude)
    const pin = latitude !== null && longitude !== null && !(latitude === 0 && longitude === 0)
        ? { latitude, longitude }
        : { latitude: null, longitude: null }
    const hasPlaceText = Boolean(name || address || parts.postalCode || parts.prefecture || parts.city || parts.street)
    if (!hasPlaceText && pin.latitude === null) { return null }

    return {
        placeId,
        name: name || null,
        address: address || null,
        category: category || null,
        postalCode: parts.postalCode,
        prefecture: parts.prefecture,
        city: parts.city,
        street: parts.street,
        latitude: pin.latitude,
        longitude: pin.longitude
    }
}

function readAddressParts(value: unknown): {
    postalCode: string | null
    prefecture: string | null
    city: string | null
    street: string | null
} {
    const components = readAddressComponents(value)
    const prefecture = componentText(components, 'administrative_area_level_1')
    const locality = componentByType(components, 'locality')
    const ward = componentByType(components, 'sublocality_level_1')
    const cityComponent = isTokyoPrefecture(prefecture) ? (ward ?? locality) : locality
    const street = components
        .map(component => ({
            component,
            rank: STREET_COMPONENT_TYPES.findIndex(type => component.types.includes(type))
        }))
        .filter(item => item.rank >= 0 && item.component !== cityComponent)
        .sort((left, right) => left.rank - right.rank)
        .map(item => item.component.longText)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

    return {
        postalCode: normalizePostalCode(componentText(components, 'postal_code')),
        prefecture,
        city: cityComponent?.longText ?? null,
        street: street || null
    }
}

function readAddressComponents(value: unknown): AddressComponent[] {
    if (!Array.isArray(value)) { return [] }

    return value.flatMap(item => {
        if (!item || typeof item !== 'object') { return [] }
        const record = item as { longText?: unknown, shortText?: unknown, types?: unknown }
        const longText = textOf(record.longText) || textOf(record.shortText)
        const types = Array.isArray(record.types)
            ? record.types.filter((type): type is string => typeof type === 'string')
            : []
        if (!longText || types.length === 0) { return [] }
        return [{ longText, types }]
    })
}

function componentByType(components: AddressComponent[], type: string): AddressComponent | null {
    return components.find(component => component.types.includes(type)) ?? null
}

function componentText(components: AddressComponent[], type: string): string | null {
    return componentByType(components, type)?.longText ?? null
}

function isTokyoPrefecture(name: string | null): boolean {
    if (name === null) { return false }
    const compact = name.replace(/\s+/g, '').toLowerCase()
    return compact === 'tokyo' || compact === '東京都'
}

function normalizePostalCode(value: string | null): string | null {
    if (value === null) { return null }
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 7) { return null }
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
}

function coordinate(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function textOf(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}
