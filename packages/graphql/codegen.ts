import type { CodegenConfig } from '@graphql-codegen/cli'

// The API schema in the server package is the only source of truth.
// Web, the API, and the MCP server all import the types this file emits.
const config: CodegenConfig = {
    overwrite: true,
    schema: '../../apps/server/src/typeDefs/schema.graphql',
    generates: {
        './src/index.ts': {
            plugins: ['typescript', 'typescript-resolvers'],
            config: {
                useTypeImports: true,
                enumsAsTypes: false
            }
        }
    }
}

export default config
