import pg from 'pg'
import { pathToFileURL } from 'node:url'
import { FacilitySource, FacilityVerificationStatus } from '@findadoc/graphql'
import { assertScriptWriteAllowed, describeScriptTarget, scriptDatabaseConfig } from './scriptDatabase.js'

/**
 * Mark the hand-entered directory as CONFIRMED. Every clinic a moderator added before the
 * government data import was checked by a person, so it should read as confirmed and show the
 * quiet "See an error?" link instead of the "Help us confirm this listing" card.
 *
 * Only UNVERIFIED rows with a city whose source is MANUAL or empty move. Imported rows
 * (MHLW_MULTILINGUAL_INSTITUTIONS) stay UNVERIFIED, so running this after the import is still
 * safe. UNVERIFIED_LOCATION rows have no single municipality and stay as they are (city-rules.md),
 * and CONFIRMED needs a city (facilities_confirmed_requires_city).
 *
 * Dry-run unless `--write` is passed. Reports counts and ids only.
 */

export type ConfirmFacilitiesReport = {
    write: boolean
    toConfirm: number
    alreadyConfirmed: number
    // Skipped: no single municipality, or online with no address.
    unverifiedLocation: number
    // Skipped: imported rows that a person has not checked.
    imported: number
    sampleIds: string[]
    updated: number
}

type CountRow = {
    to_confirm: string
    already_confirmed: string
    unverified_location: string
    imported: string
}

const SAMPLE_SIZE = 5

// $1 UNVERIFIED, $2 MANUAL. A null source is a row from before the source column, entered by hand.
const TO_CONFIRM = `
    verification_status = $1
    and city_id is not null
    and (source is null or source = $2)`

/** Plans and, with `write`, applies the flip on an open connection. */
export async function confirmExistingFacilities(
    client: pg.ClientBase,
    write: boolean
): Promise<ConfirmFacilitiesReport> {
    const counts = await client.query<CountRow>(`
        select count(*) filter (where ${TO_CONFIRM}) as to_confirm,
               count(*) filter (where verification_status = $3) as already_confirmed,
               count(*) filter (where verification_status = $4) as unverified_location,
               count(*) filter (where verification_status = $1 and source = $5) as imported
        from facilities
    `, [
        FacilityVerificationStatus.Unverified,
        FacilitySource.Manual,
        FacilityVerificationStatus.Confirmed,
        FacilityVerificationStatus.UnverifiedLocation,
        FacilitySource.MhlwMultilingualInstitutions
    ])
    const sample = await client.query<{ id: string }>(`
        select id from facilities where ${TO_CONFIRM} order by created_date limit $3
    `, [FacilityVerificationStatus.Unverified, FacilitySource.Manual, SAMPLE_SIZE])

    const row = counts.rows[0]
    const report: ConfirmFacilitiesReport = {
        write,
        toConfirm: Number(row?.to_confirm ?? 0),
        alreadyConfirmed: Number(row?.already_confirmed ?? 0),
        unverifiedLocation: Number(row?.unverified_location ?? 0),
        imported: Number(row?.imported ?? 0),
        sampleIds: sample.rows.map(sampleRow => sampleRow.id),
        updated: 0
    }

    if (write) {
        const result = await client.query(`
            update facilities
            set verification_status = $3, updated_date = now()
            where ${TO_CONFIRM}
        `, [FacilityVerificationStatus.Unverified, FacilitySource.Manual, FacilityVerificationStatus.Confirmed])
        report.updated = result.rowCount ?? 0
    }

    return report
}

export async function main(write = process.argv.includes('--write')): Promise<void> {
    assertScriptWriteAllowed(write)
    // eslint-disable-next-line no-console -- a CLI report of the target, like the other backfills
    console.log(describeScriptTarget(write))
    const client = new pg.Client(scriptDatabaseConfig())
    await client.connect()

    try {
        const report = await confirmExistingFacilities(client, write)
        // eslint-disable-next-line no-console -- counts and ids only
        console.log(JSON.stringify(report, null, 2))
        if (!write && report.toConfirm > 0) {
            // eslint-disable-next-line no-console -- CLI hint for the operator
            console.log('Dry-run only. Re-run with --write to mark these facilities CONFIRMED.')
        }
    } finally {
        await client.end()
    }
}

const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
    main().catch(error => {
        // eslint-disable-next-line no-console -- the error name only; a database error can repeat row values
        console.error(`backfillConfirmFacilities failed: ${error instanceof Error ? error.name : 'unknown error'}`)
        process.exitCode = 1
    })
}
