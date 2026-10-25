import { sql } from 'kysely'

/**
 * Serializes a value as JSONB for PostgreSQL insertion via Kysely.
 * 
 * WHY THIS EXISTS:
 * - PostgreSQL JSONB columns require explicit JSON serialization
 * - Without this, Kysely/pg driver may double-encode the JSON ({"name":"davide"} → "{\"name\":\"davide\"}")
 * - This helper ensures single-pass serialization with explicit ::jsonb cast
 * 
 *  * WHEN TO USE:
 * - ALWAYS use for INSERT operations with JSONB columns
 * - ALWAYS use for UPDATE operations that modify JSONB columns
 * - Use for JSONB @> (contains) filters
 * - NOT needed for SELECT (Kysely handles deserialization correctly)
 */
export const asJsonb = <T>(value: T) => sql<T>`${JSON.stringify(value)}::jsonb`
