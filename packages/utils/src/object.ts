export function MapDefinedFields<T>(
    objectToCopyFrom: Partial<T>,
    objectToCopyTo: { [key: string]: unknown }
) {
    for (const [key, value] of Object.entries(objectToCopyFrom)) {
        if (value !== undefined && key in objectToCopyTo) {
            objectToCopyTo[key] = value
        }
    }
}
