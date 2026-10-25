import { describe, expect, it } from 'vitest'
import { MESSAGE } from 'triple-beam'
import { productionFormat } from '../src/logger.js'

function productionLine(info: Record<string, unknown>): Record<string, unknown> {
    const formatted = productionFormat.transform({ level: 'info', message: '', ...info }) as Record<string | symbol, unknown>

    return JSON.parse(formatted[MESSAGE] as string)
}

describe('production log format', () => {
    it('writes one JSON object with the fields CloudWatch queries filter on', () => {
        const line = productionLine({
            message: 'graphql request',
            type: 'graphql',
            operationName: 'SearchFacilities',
            durationMs: 12,
            errorCount: 0
        })

        expect(line).toMatchObject({
            level: 'info',
            message: 'graphql request',
            type: 'graphql',
            operationName: 'SearchFacilities',
            durationMs: 12,
            errorCount: 0
        })
        expect(typeof line.timestamp).toBe('string')
    })

    it('keeps the stack of a logged error', () => {
        const line = productionLine({ level: 'error', message: new Error('boom') })

        expect(line.message).toBe('boom')
        expect(String(line.stack)).toContain('Error: boom')
    })
})
