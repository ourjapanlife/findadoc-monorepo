import {
    DummyDriver,
    Kysely,
    PostgresAdapter,
    PostgresIntrospector,
    PostgresQueryCompiler
} from 'kysely'
import type { Database } from '../../src/typeDefs/kyselyTypes.js'

// Builds SQL without a database connection, so a test can read the query a filter produces.
export const compileOnlyDb = new Kysely<Database>({
    dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => new DummyDriver(),
        createIntrospector: db => new PostgresIntrospector(db),
        createQueryCompiler: () => new PostgresQueryCompiler()
    }
})
