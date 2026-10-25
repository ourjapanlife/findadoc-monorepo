import { describe, expect, it } from 'vitest'
import { clinicSiteSeeds } from './clinicSiteContent.js'

describe('clinic site seed', () => {
    it('seeds the showcase clinic without a directory facility', () => {
        const site = clinicSiteSeeds.find(item => item.slug === 'multilingual-online-clinic')

        expect(site?.facility_id).toBe(null)
        expect(site?.status).toBe('preview')
        expect(site?.theme.primary).toBe('#177A80')
        expect(site?.copy['ja-JP']?.name).toBe('多言語オンラインクリニック')
        expect(site?.copy['fr-FR']?.book).not.toBe(site?.copy['en-US']?.book)

        for (const copy of Object.values(site?.copy ?? {})) {
            expect(copy.doctorCopy).toHaveLength(site?.doctors.length ?? -1)
            expect(copy.name.length).toBeGreaterThan(0)
            expect(copy.description.length).toBeGreaterThan(0)
        }
    })
})
