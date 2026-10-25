import { describe, expect, it } from 'vitest'
import { db } from '../src/kyselyClient.js'
import { createLoaders } from '../src/loaders.js'
import { getCityById } from '../src/services/cityService.js'

describe('cityById loader', () => {
    it('answers several cities from one batch, the same as one lookup each', async () => {
        const rows = await db.selectFrom('cities').select('id').orderBy('lg_code').limit(3).execute()
        const ids = rows.map(row => row.id)
        const loaders = createLoaders()

        // Loads requested in the same tick go to the database together.
        const batched = await Promise.all([...ids, '00000000-0000-0000-0000-000000000000'].map(id => loaders.cityById.load(id)))
        const oneByOne = await Promise.all(ids.map(id => getCityById(id)))

        expect(ids).toHaveLength(3)
        expect(batched.slice(0, 3)).toEqual(oneByOne)
        expect(batched[3]).toBeNull()
    })
})
