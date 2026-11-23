import { expect, type Locator, type Page } from '@playwright/test'

/** The submission queues, as the status chip's option test ids name them (#313). */
export const SUBMISSION_QUEUES = ['NEW', 'FOR_REVIEW', 'APPROVED', 'REJECTED', 'USER_FEEDBACK'] as const

export type SubmissionQueueId = typeof SUBMISSION_QUEUES[number]

/** The Status chip above the submissions list. */
export function submissionStatusChip(page: Page): Locator {
    return page.getByTestId('mod-submission-status-filter')
}

/** Leaves one queue ticked on the status chip: reset to every queue, then untick the rest. */
export async function showOnlySubmissionQueue(page: Page, queue: SubmissionQueueId): Promise<void> {
    const chip = submissionStatusChip(page)
    await chip.click()
    const reset = page.getByTestId('mod-submission-status-filter-reset')
    if (await reset.isEnabled()) {
        await reset.click()
        await chip.click()
    }
    for (const other of SUBMISSION_QUEUES.filter(item => item !== queue)) {
        await page.getByTestId(`mod-submission-status-filter-option-${other}`).click()
    }
    await page.keyboard.press('Escape')
    await expect(chip).toHaveAttribute('data-active', 'true')
}
