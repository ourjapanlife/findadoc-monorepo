import { hasUsableMapPin } from '@findadoc/utils'

export type MapPin = { id: string, position: { lat: number, lng: number }, title: string }

type PinSource = {
    id: string
    nameEn?: string | null
    nameJa?: string | null
    mapLatitude?: number | null
    mapLongitude?: number | null
}

/** The position of a facility's pin, or undefined when it has no usable coordinates. */
export function pinPosition(facility: PinSource): MapPin['position'] | undefined {
    const { mapLatitude: lat, mapLongitude: lng } = facility
    return hasUsableMapPin(lat, lng) ? { lat: lat as number, lng: lng as number } : undefined
}

/**
 * The pins the search map draws. A facility with no coordinates is left out, not drawn at a
 * default spot: that put every clinic from the #21 import, which stored only a Place ID, in
 * central Tokyo.
 */
export function mapPins(facilities: readonly PinSource[]): MapPin[] {
    return facilities.flatMap(facility => {
        const position = pinPosition(facility)
        return position
            ? [{ id: facility.id, position, title: facility.nameEn || facility.nameJa || 'Facility' }]
            : []
    })
}
