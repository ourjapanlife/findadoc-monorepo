/**
 * Forward movement through a new multi-step flow.
 * A jump may not skip a step the person has not opened yet.
 * Opening the next new step is only allowed from the furthest step already opened.
 * Moving backward does not use this check.
 */
export function skipsUnreachedStep(input: {
    from: number
    to: number
    maxReached: number
}): boolean {
    return input.to > input.maxReached + 1
        || (input.to > input.maxReached && input.from !== input.maxReached)
}
