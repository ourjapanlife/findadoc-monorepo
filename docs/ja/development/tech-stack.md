# 技術スタック

## フロントエンド (findadoc-web)

| 技術 | 用途 |
|-----------|---------|
| [Nuxt 3](https://nuxt.com/) | Vueベースのメタフレームワーク（SSGモード） |
| [Vue 3](https://vuejs.org/) | UIフレームワーク（Composition API） |
| [TypeScript](https://www.typescriptlang.org/) | 型安全なJavaScript |
| [Tailwind CSS](https://tailwindcss.com/) | ユーティリティファーストCSSフレームワーク |
| [Pinia](https://pinia.vuejs.org/) | 状態管理 |
| [GraphQL](https://graphql.org/) | APIクエリ言語 |
| [graphql-request](https://github.com/jasonkuhrt/graphql-request) | 軽量GraphQLクライアント |
| [Nuxt i18n](https://i18n.nuxtjs.org/) | 国際化（10言語対応） |
| [Auth0](https://auth0.com/) | 認証 |
| [Google Maps API](https://developers.google.com/maps) | 地図・位置情報サービス |
| [Vitest](https://vitest.dev/) | ユニットテスト |
| [Cypress](https://www.cypress.io/) | E2Eテスト |
| [Storybook](https://storybook.js.org/) | コンポーネント開発・ドキュメント |
| [ESLint](https://eslint.org/) | リンティング |
| [Husky](https://typicode.github.io/husky/) | Gitフック |

### 必要条件

- **Node.js** >= 22.12.0
- **Yarn** 4.x（Corepack経由）

## バックエンド (findadoc-server)

| 技術 | 用途 |
|-----------|---------|
| [Node.js](https://nodejs.org/) | ランタイム |
| [TypeScript](https://www.typescriptlang.org/) | 型安全なJavaScript |
| [GraphQL](https://graphql.org/) | APIレイヤー |
| [Supabase](https://supabase.com/) | データベース（PostgreSQL） |
| [PM2](https://pm2.keymetrics.io/) | プロセス管理（本番環境） |
| [Docker](https://www.docker.com/) | コンテナ化 |
| [Vitest](https://vitest.dev/) | テスト |

## MCPサーバー (findadoc-mcp)

| 技術 | 用途 |
|-----------|---------|
| [Node.js](https://nodejs.org/) | ランタイム |
| [TypeScript](https://www.typescriptlang.org/) | 型安全なJavaScript |
| [Model Context Protocol](https://modelcontextprotocol.io/) | AIツール連携 |

MCPサーバーは、Find a Docの医療機関データにAIがアクセスするためのツールを提供します。

## コードスタイル

- すべてのプロジェクトでフラットコンフィグの**ESLint**を使用
- PRタイトルは[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary)に従う必要があります（CIで強制）
- ブランチ名にはGitHubユーザー名をプレフィックスとして付けてください：`yourusername/my-change`
