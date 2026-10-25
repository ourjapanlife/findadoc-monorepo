import * as gqlTypes from '@findadoc/graphql'
import * as dbSchema from '../src/typeDefs/dbSchema.js'
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as auditLogService from '../src/services/auditLogServiceSupabase.js'
import { generateRandomCreateSubmissionInput } from '../src/fakeData/fakeSubmissions.js'
import { mapGqlEntityToDbEntity } from '../src/services/mappersEntityService.js'
import { createSubmission, updateSubmission, deleteSubmission } from '../src/services/submissionService.js'
import { db } from '../src/kyselyClient.js'

describe('Audit Log System', () => {
    describe('createAuditLog', () => {
        it('should create an audit log successfully', async () => {        
            const newSubmission: gqlTypes.CreateSubmissionInput = generateRandomCreateSubmissionInput()
            const newAuditLog: dbSchema.SubmissionInsertRow = mapGqlEntityToDbEntity(newSubmission)
            
            await expect(
                auditLogService.createAuditLogSQL({
                    actionType: gqlTypes.ActionType.Create,
                    objectType: gqlTypes.ObjectType.Submission,
                    updatedBy: 'user123',
                    newValue: newAuditLog,
                    oldValue: null
                })
            ).resolves.not.toThrow()
        })

        it('should handle different action types (Create, Update, Delete)', async () => {
            const submission = generateRandomCreateSubmissionInput()
            const dbSubmission = mapGqlEntityToDbEntity(submission)

            // Test CREATE
            await expect(
                auditLogService.createAuditLogSQL({
                    actionType: gqlTypes.ActionType.Create,
                    objectType: gqlTypes.ObjectType.Submission,
                    updatedBy: 'user123',
                    newValue: dbSubmission
                })
            ).resolves.not.toThrow()

            // Test UPDATE
            await expect(
                auditLogService.createAuditLogSQL({
                    actionType: gqlTypes.ActionType.Update,
                    objectType: gqlTypes.ObjectType.Submission,
                    updatedBy: 'user123',
                    oldValue: dbSubmission,
                    newValue: { ...dbSubmission, notes: 'Updated notes' }
                })
            ).resolves.not.toThrow()

            // Test DELETE
            await expect(
                auditLogService.createAuditLogSQL({
                    actionType: gqlTypes.ActionType.Delete,
                    objectType: gqlTypes.ObjectType.Submission,
                    updatedBy: 'user123',
                    oldValue: dbSubmission
                })
            ).resolves.not.toThrow()
        })
    })

    describe('Rollback on Audit Log Failure', () => {
        afterEach(() => {
            // Restore all mocks after each test
            vi.restoreAllMocks()
        })

        it('should rollback submission creation if audit log fails', async () => {
            // Mock using vi.spyOn
            const spy = vi.spyOn(auditLogService, 'createAuditLog')
                .mockRejectedValue(new Error('Audit log failed'))

            const submissionInput = generateRandomCreateSubmissionInput()

            // Attempt to create submission (should fail due to audit log)
            const result = await createSubmission(submissionInput, 'testUser')

            // Verify spy was called
            expect(spy).toHaveBeenCalled()

            // Verify creation failed
            expect(result.hasErrors).toBe(true)
            expect(result.errors).toBeDefined()

            // If a submission ID exists, verify it was rolled back
            if (result.data?.id) {
                const checkSubmission = await db
                    .selectFrom('submissions')
                    .select('id')
                    .where('id', '=', result.data.id)
                    .executeTakeFirst()

                // Should be missing because rollback deleted it
                expect(checkSubmission).toBeUndefined()
            }
        })

        it('should rollback submission update if audit log fails', async () => {
            // First, create a submission successfully (no mock yet)
            const submissionInput = generateRandomCreateSubmissionInput()
            const createResult = await createSubmission(submissionInput, 'testUser')
            
            expect(createResult.hasErrors).toBe(false)
            const submissionId = createResult.data.id

            // Get original state
            const originalData = await db
                .selectFrom('submissions')
                .select(['notes', 'updated_date'])
                .where('id', '=', submissionId)
                .executeTakeFirstOrThrow()

            // NOW mock the audit log to fail
            const spy = vi.spyOn(auditLogService, 'createAuditLog')
                .mockRejectedValue(new Error('Audit log failed'))

            // Try to update (should fail and rollback)
            const updateResult = await updateSubmission(
                submissionId,
                { notes: 'This should be rolled back' },
                'testUser'
            )

            expect(spy).toHaveBeenCalled()
            expect(updateResult.hasErrors).toBe(true)

            // Verify data was rolled back to original
            const afterRollback = await db
                .selectFrom('submissions')
                .select(['notes', 'updated_date'])
                .where('id', '=', submissionId)
                .executeTakeFirstOrThrow()

            expect(afterRollback.notes).toBe(originalData.notes)
            expect(afterRollback.updated_date).toBe(originalData.updated_date)

            // Cleanup
            await db.deleteFrom('submissions').where('id', '=', submissionId).execute()
        })

        it('should rollback submission deletion if audit log fails', async () => {
            // First, create a submission
            const submissionInput = generateRandomCreateSubmissionInput()
            const createResult = await createSubmission(submissionInput, 'testUser')
            
            expect(createResult.hasErrors).toBe(false)
            const submissionId = createResult.data.id

            // Save original data
            const originalData = await db
                .selectFrom('submissions')
                .selectAll()
                .where('id', '=', submissionId)
                .executeTakeFirstOrThrow()

            // Mock audit log to fail
            const spy = vi.spyOn(auditLogService, 'createAuditLog')
                .mockRejectedValue(new Error('Audit log failed'))

            // Try to delete (should fail and rollback)
            const deleteResult = await deleteSubmission(submissionId, 'testUser')

            expect(spy).toHaveBeenCalled()
            expect(deleteResult.hasErrors).toBe(true)
            expect(deleteResult.data.isSuccessful).toBe(false)

            // Verify submission still exists (rollback worked)
            const afterRollback = await db
                .selectFrom('submissions')
                .select(['id', 'google_maps_url'])
                .where('id', '=', submissionId)
                .executeTakeFirst()

            expect(afterRollback).toBeDefined()
            expect(afterRollback?.id).toBe(originalData.id)
            expect(afterRollback?.google_maps_url).toBe(originalData.google_maps_url)

            // Cleanup
            await db.deleteFrom('submissions').where('id', '=', submissionId).execute()
        })
    })

    describe('Edge Cases', () => {
        it('should handle audit log with null values correctly', async () => {
            const submission = mapGqlEntityToDbEntity(generateRandomCreateSubmissionInput())

            // CREATE with null oldValue
            await expect(
                auditLogService.createAuditLogSQL({
                    actionType: gqlTypes.ActionType.Create,
                    objectType: gqlTypes.ObjectType.Submission,
                    updatedBy: 'testUser',
                    newValue: submission,
                    oldValue: null
                })
            ).resolves.not.toThrow()

            // DELETE with null newValue
            await expect(
                auditLogService.createAuditLogSQL({
                    actionType: gqlTypes.ActionType.Delete,
                    objectType: gqlTypes.ObjectType.Submission,
                    updatedBy: 'testUser',
                    oldValue: submission,
                    newValue: null
                })
            ).resolves.not.toThrow()
        })

        it('should use enum values correctly', async () => {
            const submission = mapGqlEntityToDbEntity(generateRandomCreateSubmissionInput())

            // Test all ActionType enum values
            for (const actionType of Object.values(gqlTypes.ActionType)) {
                await expect(
                    auditLogService.createAuditLogSQL({
                        actionType,
                        objectType: gqlTypes.ObjectType.Submission,
                        updatedBy: 'testUser',
                        newValue: submission
                    })
                ).resolves.not.toThrow()
            }
        })
    })
})
