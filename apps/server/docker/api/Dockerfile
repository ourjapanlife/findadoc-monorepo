FROM node:22-bookworm-slim

WORKDIR /usr/src/app

ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY packages/graphql/package.json packages/graphql/package.json
COPY packages/graphql/codegen.ts packages/graphql/codegen.ts
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/tsconfig/base.json packages/tsconfig/base.json

RUN pnpm install --frozen-lockfile --filter @findadoc/server...

COPY apps/server apps/server
COPY packages/graphql packages/graphql
COPY packages/tsconfig packages/tsconfig

RUN pnpm --filter @findadoc/graphql build && pnpm --filter @findadoc/server build

WORKDIR /usr/src/app/apps/server

EXPOSE 4000

CMD ["pnpm", "prod:startserver"]
