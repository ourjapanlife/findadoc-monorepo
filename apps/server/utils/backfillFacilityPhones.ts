import pg from 'pg'
import { pathToFileURL } from 'node:url'
import { envVariables } from './environmentVariables.js'
import { phoneForStorage } from '../src/validation/validatePhone.js'
import { toJapanE164 } from './stringUtils.js'

/**
 * Rewrite stored facility phones to E.164 (`+81312345678`), the form the API now writes.
 * Dry-run unless `--write` is passed.
 * A phone that does not parse as a Japanese number is left alone and its facility id is listed
 * for a moderator. Output is counts and ids only: a phone number is never printed.
 */

type FacilityPhoneRow = {
    id: string
    phone: string | null
}

export const PHONE_PLAN = {
    EMPTY: 'empty',
    ALREADY_E164: 'alreadyE164',
    NORMALIZE: 'normalize',
    UNPARSEABLE: 'unparseable'
} as const

export type PhonePlanAction = typeof PHONE_PLAN[keyof typeof PHONE_PLAN]

export type PhonePlan = {
    id: string
    action: PhonePlanAction
    /** Present only for NORMALIZE: the stored value to compare against, and the E.164 value. */
    current?: string
    next?: string
}

export type PhoneBackfillReport = {
    total: number
    empty: number
    alreadyE164: number
    normalize: number
    unparseable: number
    unparseableIds: string[]
}

/** What the backfill does with one stored phone. */
export function planFacilityPhone(row: FacilityPhoneRow): PhonePlan {
    const current = row.phone ?? ''
    if (current.trim() === '') {
        return { id: row.id, action: PHONE_PLAN.EMPTY }
    }
    if (toJapanE164(current) === null) {
        return { id: row.id, action: PHONE_PLAN.UNPARSEABLE }
    }
    const next = phoneForStorage(current)
    if (next === current) {
        return { id: row.id, action: PHONE_PLAN.ALREADY_E164 }
    }
    return { id: row.id, action: PHONE_PLAN.NORMALIZE, current, next }
}

/** Counts for every plan, plus the ids a moderator has to fix by hand. */
export function reportFacilityPhones(plans: PhonePlan[]): PhoneBackfillReport {
    const count = (action: PhonePlanAction) => plans.filter(plan => plan.action === action).length

    return {
        total: plans.length,
        empty: count(PHONE_PLAN.EMPTY),
        alreadyE164: count(PHONE_PLAN.ALREADY_E164),
        normalize: count(PHONE_PLAN.NORMALIZE),
        unparseable: count(PHONE_PLAN.UNPARSEABLE),
        unparseableIds: plans.filter(plan => plan.action === PHONE_PLAN.UNPARSEABLE).map(plan => plan.id)
    }
}

function clientConfig() {
    const password = envVariables.pgPassword()
    const host = envVariables.pgHost() || '127.0.0.1'
    const port = Number(envVariables.pgPort() || (envVariables.isProduction() ? 5432 : 54322))

    if (port === 6543) {
        throw new Error('Use the session database port 5432. The transaction pooler cannot apply this backfill.')
    }

    return {
        host,
        port,
        user: envVariables.pgUser() || 'postgres',
        password: password || 'postgres',
        database: 'postgres'
    }
}

async function writePlans(client: pg.Client, plans: PhonePlan[]): Promise<number> {
    let written = 0
    await client.query('begin')

    try {
        for (const plan of plans) {
            if (plan.action !== PHONE_PLAN.NORMALIZE || plan.next === undefined || plan.current === undefined) {
                continue
            }
            // Compare-and-set: a moderator edit between the read and this write wins.
            const result = await client.query(
                `update facilities
                 set contact = jsonb_set(contact, '{phone}', to_jsonb($1::text), false),
                     updated_date = now()
                 where id = $2 and contact ->> 'phone' = $3`,
                [plan.next, plan.id, plan.current]
            )
            written += result.rowCount ?? 0
        }
        await client.query('commit')
    } catch (error) {
        await client.query('rollback').catch(() => {
            console.error('Rollback failed')
        })
        throw error
    }
    return written
}

async function main() {
    const write = process.argv.includes('--write')
    const client = new pg.Client(clientConfig())
    await client.connect()

    try {
        const facilities = await client.query<FacilityPhoneRow>(
            `select id, contact ->> 'phone' as phone from facilities order by id`
        )
        const plans = facilities.rows.map(planFacilityPhone)
        const report = reportFacilityPhones(plans)
        const written = write ? await writePlans(client, plans) : 0

        console.log(JSON.stringify({ write, ...report, written }, null, 2))
    } finally {
        await client.end()
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        // The message from pg can quote a value; print only its code.
        const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown'
        console.error(`Phone backfill failed (${code})`)
        process.exitCode = 1
    })
}
