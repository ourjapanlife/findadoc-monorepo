/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { mapPins, pinPosition } from '@/utils/mapPins'

describe('mapPins', () => {
    it('leaves a facility with no coordinates off the map instead of placing it in Tokyo', () => {
        const pins = mapPins([
            { id: 'hiroshima', nameEn: 'Hiroshima Clinic', mapLatitude: 34.39, mapLongitude: 132.46 },
            { id: 'imported', nameEn: 'Imported Clinic', mapLatitude: null, mapLongitude: null },
            { id: 'zero', nameEn: 'Zero Pin', mapLatitude: 0, mapLongitude: 0 }
        ])

        expect(pins).to.deep.equal([
            { id: 'hiroshima', position: { lat: 34.39, lng: 132.46 }, title: 'Hiroshima Clinic' }
        ])
    })

    it('titles a pin with the Japanese name when there is no English one', () => {
        expect(mapPins([{ id: 'a', nameEn: '', nameJa: '広島クリニック', mapLatitude: 34.39, mapLongitude: 132.46 }])[0]?.title)
            .to.equal('広島クリニック')
    })
})

describe('pinPosition', () => {
    it('has no position for a facility without coordinates', () => {
        expect(pinPosition({ id: 'a', mapLatitude: null, mapLongitude: 132.46 })).to.equal(undefined)
    })
})
