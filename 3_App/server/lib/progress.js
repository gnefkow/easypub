/** Shared Update-Epub progress state for queue + progress routes. */
export const progressState = new Map()

export const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve))
