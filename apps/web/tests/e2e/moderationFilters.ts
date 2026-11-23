import { expect, type Locator, type Page } from '@playwright/test'

/** The submission queues, as the status chip's option test ids name them (#313). */
export const SUBMISSION_QUEUES = ['NEW', 'FOR_REVIEW', 'APPROVED', 'REJECTED', 'USER_FEEDBACK'] as const

export type SubmissionQueueId = typeof SUBMISSION_QUEUES[number]

/** The Status chip above the submissions list. */
export function submissionStatusChip(page: Page): Locator {
    return page.getByTestId('mod-submission-status-filter')
}

/** Leaves one queue ticked on the status chip: reset to New, tick the queue, then untick New. */
export async function showOnlySubmissionQueue(page: Page, queue: SubmissionQueueId): Promise<void> {
    const chip = submissionStatusChip(page)
    await chip.click()
    const reset = page.getByTestId('mod-submission-status-filter-reset')
    if (await reset.isEnabled()) {
        await reset.click()
        await chip.click()
    }
    if (queue !== 'NEW') {
        await page.getByTestId(`mod-submission-status-filter-option-${queue}`).click()
        await page.getByTestId('mod-submission-status-filter-option-NEW').click()
    }
    for (const item of SUBMISSION_QUEUES) {
        const option = page.getByTestId(`mod-submission-status-filter-option-${item}`)
        await (item === queue ? expect(option).toBeChecked() : expect(option).not.toBeChecked())
    }
    await page.keyboard.press('Escape')
    await expect(chip).toHaveAttribute('data-active', queue === 'NEW' ? 'false' : 'true')
}
