# アーキテクチャ

## システム概要

Find a Docは1つのモノレポにある3つのアプリで構成され、1つのGraphQLスキーマから生成された型を共有しています：

```
┌─────────────────┐     GraphQL     ┌──────────────────┐     SQL      ┌─────────────────┐
│    apps/web     │ ◄─────────────► │   apps/server    │ ◄──────────► │  Amazon RDS     │
│  (Nuxt 4 site)  │                 │ (Apollo GraphQL) │              │  (PostgreSQL)   │
└─────────────────┘                 └──────────────────┘              └─────────────────┘
                                             ▲
                                             │ GraphQL
                                    ┌────────┴─────────┐
                                    │    apps/mcp      │ ◄── MCP / REST ── AI assistants
                                    │   (MCP server)   │
                                    └──────────────────┘
```

### ウェブサイト（`apps/web`）

- **フレームワーク**：Nuxt 4（`nuxi generate`でプリレンダリングし、AWS Amplifyでホスティング）
- **UI**：Vue 3 Composition API + Tailwind CSS
- **状態管理**：Piniaストア
- **API**：`graphql-request`によるGraphQL
- **認証**：Auth0（モデレーションダッシュボード用）
- **地図**：Google Maps API（医療機関の位置表示）
- **国際化**：Nuxt i18n（11言語対応）。クリニック、医師、ハブ、ファセットのページは英語と日本語でプリレンダリング

### API（`apps/server`）

- **ランタイム**：Node.js + TypeScript
- **API**：Fastify上のApollo Server
- **スキーマ**：`apps/server/src/typeDefs/schema.graphql`（リポジトリ内で唯一のGraphQLスキーマ）
- **データベース**：東京リージョンのAmazon RDS for PostgreSQL。マイグレーションは `apps/server/supabase/migrations` にあり、デプロイのたびに適用される。APIはKyselyでクエリする
- **本番環境**：CloudFrontの背後にあるAWS Lambda（`api.findadoc.jp`）。`infra/` のCDKアプリでデプロイ

### MCPサーバー（`apps/mcp`）

- **プロトコル**：Streamable HTTPとSTDIOによるModel Context Protocol
- **目的**：医療機関データをAIアシスタントに公開し、同じツールをRESTエンドポイントとしても提供

### 共有パッケージ

| パッケージ | 用途 |
|---------|---------|
| `packages/graphql` | `@findadoc/graphql`。スキーマから生成したTypeScript型。`pnpm generate`で再生成 |
| `packages/utils` | `@findadoc/utils`。サイトとAPIで共有するチェックとヘルパー |
| `packages/tsconfig` | 共有TypeScript設定 |

## ウェブサイトのディレクトリ構成

| ディレクトリ | 用途 |
|-----------|---------|
| `apps/web/components/` | 再利用可能なVueコンポーネント |
| `apps/web/pages/` | ルートページ（Nuxtによる自動登録） |
| `apps/web/stores/` | Piniaストア |
| `apps/web/i18n/locales/` | 翻訳ファイル（`en.json`と照合） |
| `apps/web/assets/` | 未コンパイルのアセット（CSS、画像、フォント） |
| `apps/web/typedefs/` | TypeScript型定義 |
| `apps/web/public/` | ルートで配信される静的ファイル（例：`robots.txt`） |

## データフロー

1. ユーザーが[findadoc.jp](https://www.findadoc.jp)で医療機関を検索
2. ウェブサイトがAPIにGraphQLクエリを送信
3. APIがAmazon RDS上のPostgreSQLデータベースに対してクエリを実行
4. 結果がインタラクティブな地図上に医療機関の詳細とともに表示される

## 関連資料

コードが従うルールは、モノレポ内のコードの近くにあります：

- `AGENTS.md`：リポジトリ全体に関するコントリビューターとコーディングエージェント向けのメモ
- `apps/server/docs/city-rules.md`：検索用の市区町村名の決め方
- `apps/server/docs/places-storage.md`：保存してよいGoogle Placesのデータ
