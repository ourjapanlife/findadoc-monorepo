import pg from 'pg'
import { pathToFileURL } from 'node:url'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'
import { canonicalMapsLink, resolveMapsPlace } from '../src/places/mapsLink.js'

/**
 * Fill google_place_id from the Maps link already stored on a facility.
 * Dry-run unless `--write` is passed.
 * A short link is opened once so its redirect can be read. Places Text Search is not called.
 * The stored Maps URL is rewritten to the normalized form that carries the place id.
 * Name and address are never changed.
 * Online facilities have no place and are skipped. With `--write`, once no facility with an
 * address is missing a place id, the facilities_place_id_required constraint is validated (#228).
 */

type FacilityRow = {
    id: string
    name_en: string
    name_ja: string
    google_maps_url: string | null
}

export async function main(write = process.argv.includes('--write')) {
    assertScriptWriteAllowed(write)
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    const counts = { written: 0, unmatched: 0, remaining: 0, validated: false }
    try {
        const facilities = await client.query<FacilityRow>(`
            select id, name_en, name_ja, contact #>> '{googleMapsUrl}' as google_maps_url
            from facilities
            where coalesce(btrim(google_place_id), '') = ''
              and online = false
              and coalesce(contact #>> '{googleMapsUrl}', '') <> ''
            order by updated_date desc
        `)

        for (const facility of facilities.rows) {
            const storedUrl = facility.google_maps_url ?? ''
            const target = await resolveMapsPlace(storedUrl)
            const canonical = target ? canonicalMapsLink(target) : null
            if (!target?.placeId || !canonical) {
                counts.unmatched += 1
                console.log(`unmatched ${facility.id} ${facility.name_en} ${storedUrl}`)
                continue
            }

            if (!write) {
                counts.written += 1
                console.log(`would write ${facility.id} ${target.placeId} ${canonical}`)
                continue
            }

            const result = await client.query(
                `update facilities
                 set google_place_id = $1,
                     contact = jsonb_set(contact, '{googleMapsUrl}', to_jsonb($2::text), true),
                     updated_date = now()
                 where id = $3 and coalesce(btrim(google_place_id), '') = ''`,
                [target.placeId, canonical, facility.id]
            )
            if ((result.rowCount ?? 0) > 0) {
                counts.written += 1
                console.log(`write ${facility.id} ${target.placeId}`)
            }
        }

        const remaining = await client.query<{ id: string }>(`
            select id from facilities
            where online = false and coalesce(btrim(google_place_id), '') = ''
            order by id
        `)
        counts.remaining = remaining.rows.length
        for (const row of remaining.rows) {
            console.log(`still missing a place id ${row.id}`)
        }
        if (write && counts.remaining === 0) {
            await client.query('alter table facilities validate constraint facilities_place_id_required')
            counts.validated = true
        }
    } finally {
        await client.end()
    }

    console.log(counts)
    return counts
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(error)
        process.exitCode = 1
    })
}
