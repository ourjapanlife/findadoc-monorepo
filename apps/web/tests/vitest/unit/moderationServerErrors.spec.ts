import { describe, expect, it } from 'vitest'
import { ErrorCode } from '~/typedefs/serverResponse'
import { hasServerErrors } from '~/utils/moderationUtils'

describe('hasServerErrors', () => {
    it('treats hasErrors as a failure when the error list is empty', () => {
        expect(hasServerErrors(undefined)).toBe(false)
        expect(hasServerErrors({ errors: [], hasErrors: false })).toBe(false)
        expect(hasServerErrors({ hasErrors: true })).toBe(true)
        expect(hasServerErrors({
            errors: [{ message: 'timed out', code: ErrorCode.NETWORK, field: undefined }]
        })).toBe(true)
    })
})
