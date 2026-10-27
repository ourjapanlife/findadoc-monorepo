# 技術スタック

## モノレポ

| 技術 | 用途 |
|-----------|---------|
| [pnpm](https://pnpm.io/) | パッケージマネージャーとワークスペース |
| [Turborepo](https://turborepo.com/) | パッケージ横断のタスク実行 |
| [TypeScript](https://www.typescriptlang.org/) | 型安全なJavaScript |
| [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) | `@findadoc/graphql` の共有型 |
| [ESLint](https://eslint.org/) | リンティング |
| [Husky](https://typicode.github.io/husky/) | Gitフック |
| [GitHub Actions](https://docs.github.com/en/actions) | リンティング、型チェック、テスト、ドキュメントのデプロイ |
| [Renovate](https://docs.renovatebot.com/) | pnpmワークスペースの依存関係の更新 |

リポジトリルートの `renovate.json` 1つがワークスペース全体を対象にします。Renovateはこのリポジトリにプルリクエストを開きます。廃止した単体アプリのリポジトリには開きません。

### 要件

- **Node.js** 24.22.0（`.nvmrc`を参照）
- **pnpm** 10.27.0（Corepack経由）

## ウェブサイト（`apps/web`）

| 技術 | 用途 |
|-----------|---------|
| [Nuxt 4](https://nuxt.com/) | Vueベースのメタフレームワーク（`nuxi generate`でプリレンダリング） |
| [Vue 3](https://vuejs.org/) | UIフレームワーク（Composition API） |
| [Tailwind CSS 4](https://tailwindcss.com/) | ユーティリティファーストCSSフレームワーク |
| [Pinia](https://pinia.vuejs.org/) | 状態管理 |
| [graphql-request](https://github.com/jasonkuhrt/graphql-request) | 軽量GraphQLクライアント |
| [Nuxt i18n](https://i18n.nuxtjs.org/) | 国際化（11言語） |
| [Auth0](https://auth0.com/) | モデレーション用の認証 |
| [Google Maps API](https://developers.google.com/maps) | 地図・位置情報サービス |
| [Sentry](https://sentry.io/) | エラー報告 |
| [Vitest](https://vitest.dev/) | ユニットテスト |
| [Playwright](https://playwright.dev/) | E2Eテスト |
| [Storybook](https://storybook.js.org/) | コンポーネント開発とドキュメント |
| [AWS Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html) | ホスティング |

## API（`apps/server`）

| 技術 | 用途 |
|-----------|---------|
| [Node.js](https://nodejs.org/) | ランタイム |
| [Apollo Server](https://www.apollographql.com/docs/apollo-server/) | Fastify上のGraphQL API |
| [Supabase](https://supabase.com/) | データベース（PostgreSQL） |
| [Kysely](https://kysely.dev/) | PostgreSQLへの型付きSQLクエリ |
| [Sentry](https://sentry.io/) | エラー報告 |
| [PM2](https://pm2.keymetrics.io/) | プロセス管理（本番環境） |
| [Docker](https://www.docker.com/) | コンテナ化 |
| [Vitest](https://vitest.dev/) | テスト |

## MCPサーバー（`apps/mcp`）

| 技術 | 用途 |
|-----------|---------|
| [Node.js](https://nodejs.org/) | ランタイム |
| [Model Context Protocol](https://modelcontextprotocol.io/) | Streamable HTTPとSTDIOによるAIツール連携 |
| [Vitest](https://vitest.dev/) | テスト |

MCPサーバーは、Find a Docの医療機関データをAIアシスタントに公開します。HTTPサーバーは同じツールを、`apps/mcp/openapi.yaml`で定義されたRESTエンドポイントとしても提供します。

## ドキュメント（`apps/docs`）

| 技術 | 用途 |
|-----------|---------|
| [Zensical](https://zensical.org/) | このサイトの静的サイトジェネレーター |
| [GitHub Pages](https://pages.github.com/) | [docs.findadoc.jp](https://docs.findadoc.jp) のホスティング |

## コードスタイル

- すべてのパッケージでフラットコンフィグの**ESLint**を使用
- PRタイトルは[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary)に従う必要があります（CIで強制）
- ブランチ名にはGitHubユーザー名をプレフィックスとして付けてください：`yourusername/my-change`
