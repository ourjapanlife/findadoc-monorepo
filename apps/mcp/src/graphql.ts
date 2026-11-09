import { GraphQLClient } from 'graphql-request'

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://api.findadoc.jp'

/**
 * Every MCP read is on the API's public list, so it goes as a GET that CloudFront may answer
 * from its cache (#242). graphql-request still sends a mutation as POST, and the MCP server sends none.
 */
export const gqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, { method: 'GET' })
