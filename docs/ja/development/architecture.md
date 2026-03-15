# アーキテクチャ

## システム概要

Find a Docは3つの主要サービスで構成されています：

```
┌─────────────────┐     GraphQL     ┌─────────────────┐     SQL      ┌─────────────────┐
│  findadoc-web   │ ◄─────────────► │ findadoc-server  │ ◄──────────► │    Supabase      │
│  (Nuxt 3 SSG)   │                 │ (Node.js/GraphQL)│              │  (PostgreSQL)    │
└─────────────────┘                 └─────────────────┘              └─────────────────┘
                                           ▲
                                           │ MCP Protocol
                                    ┌──────┴──────────┐
                                    │  findadoc-mcp    │
                                    │  (MCP Server)    │
                                    └─────────────────┘
```

### findadoc-web（フロントエンド）

- **フレームワーク**：Nuxt 3（静的サイト生成モード）
- **UI**：Vue 3 Composition API + Tailwind CSS
- **状態管理**：Piniaストア
- **API**：`graphql-request`によるGraphQL
- **認証**：Auth0（モデレーションダッシュボード用）
- **地図**：Google Maps API（医療機関の位置表示）
- **国際化**：Nuxt i18n（10言語対応）

### findadoc-server（バックエンド）

- **ランタイム**：Node.js + TypeScript
- **API**：GraphQL
- **データベース**：Supabase（PostgreSQL）
- **本番環境**：PM2で管理されるDockerコンテナ

### findadoc-mcp（MCPサーバー）

- **プロトコル**：AIツール連携のためのModel Context Protocol
- **目的**：医療機関データをAIアシスタントに公開

## フロントエンドのディレクトリ構成

| ディレクトリ | 用途 |
|-----------|---------|
| `components/` | 再利用可能なVueコンポーネント |
| `pages/` | ルートページ（Nuxtによる自動登録） |
| `assets/` | 未コンパイルのアセット（CSS、画像、フォント） |
| `typedefs/` | TypeScript型定義 |
| `public/` | ルートで配信される静的ファイル（例：`robots.txt`） |

## データフロー

1. ユーザーが[findadoc.jp](https://www.findadoc.jp)で医療機関を検索
2. フロントエンドがバックエンドAPIにGraphQLクエリを送信
3. バックエンドがSupabase PostgreSQLデータベースに対してクエリを実行
4. 結果がインタラクティブな地図上に医療機関の詳細とともに表示される
