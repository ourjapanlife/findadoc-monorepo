import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { envVariables } from '../utils/environmentVariables.js'
import { initializeLogger, logger } from './logger.js'

const localSupabaseUrl = 'http://127.0.0.1:54321'

export type SupabaseCheck = {
    ok: boolean
    url: string
    error?: string
}

export const checkLocalSupabase = async (): Promise<SupabaseCheck> => {
    const url = envVariables.supabaseUrl() || localSupabaseUrl
    const serviceKey = envVariables.supabaseServiceRoleKey()

    if (!serviceKey) {
        return { ok: false, url, error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }
    }

    try {
        const client = createClient(url, serviceKey)
        const { error } = await client
            .from('user')
            .select('id')
            .limit(1)
            .abortSignal(AbortSignal.timeout(3000))

        if (error) {
            return { ok: false, url, error: error.message }
        }

        return { ok: true, url }
    } catch (ex) {
        const error = ex instanceof Error ? ex.message : String(ex)

        return { ok: false, url, error }
    }
}

const invokedDirectly = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
    initializeLogger()

    const result = await checkLocalSupabase()

    if (result.ok) {
        logger.info(`Local Supabase is reachable at ${result.url}`)
        process.exit(0)
    }

    logger.error(`Local Supabase is not reachable at ${result.url}: ${result.error}`)
    process.exit(1)
}
