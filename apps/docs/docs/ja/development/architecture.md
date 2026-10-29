# アーキテクチャ

## システム概要

Find a Docは1つのモノレポにある3つのアプリで構成され、1つのGraphQLスキーマから生成された型を共有しています：

```
┌─────────────────┐     GraphQL     ┌──────────────────┐     SQL      ┌─────────────────┐
│    apps/web     │ ◄─────────────► │   apps/server    │ ◄──────────► │    Supabase     │
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
- **クリニックの独自ページ**：独自ページは `clinic_sites` の1行。アカウント（`clinic_memberships`）と、これからのCRMが紐づくのはこのid。ショーケースのディレクトリ施設は `c32c316a-a368-499b-abaf-c5c973cb67e5` です。このページに市区町村がないので、種データのその行は未確定のままです。共有するURLは `https://{slug}.findadoc.jp/` です。そのホストの `/` でクリニックを開きます。予約は常に Find a Doc 本体の `/book/{facilityId}` です（クリニックホストの `/book` はそこへ転送します）。独自ページが無いディレクトリのクリニックも同じURLです。フォームの項目は Find a Doc が持ち、クリニックは 15・30・45・60 分の診察時間、日本時間の週の診療時間、臨時の受付時間、休診を持ちます。任意のクエリは `duration`、`start`、`practitioner`、`form`、`service` です。送信内容・S3（またはローカル）アップロード・設定時のSES通知を保存します。空き枠は、週の診療時間と臨時の受付時間から、休診と押さえ済みの予約を引いたものです（`apps/server/docs/booking-access.md`）。スタッフは週の診療時間を「設定」で決め、FullCalendar で休診日や時間帯を閉じます。どちらもクリニック全体か医師1人ごとに設定でき、自分の時間を持つ医師は別々に予約を受けます。患者は言語で絞り込み、医師（または誰でも）を選び、選んだ時間の長さに合う開始時刻を選びます。マイページの予約一覧は閲覧のみで、回答の編集はありません。本人確認・保険のアップロードには短い `retain_until` があり、Lambda `findadoc-booking-purge` が毎日削除します（`apps/server/docs/booking-retention.md`）。予約フォーム、空き枠、アップロード、送信は公開です。予約一覧と空き枠カレンダーはサインインしたセッションが必要です。ページにクリニックのヘッダーはなく、Find a Doc の「Powered by」フッターだけです。正規URLはそのサブドメインです。DNSは Route 53 のままです。`?preview=1` がCookieを保存します。Cookieが無いページは404で、noindex のまま、サイトマップにも入りません。環境変数はありません。クリニックのパンくず、`/clinic/{slug}`、`/clinic/{prefecture}/{city}/{slug}--{id}` はそこへ転送します。リンクのプレビュー画像はそのクリニックのアイコン。保存したテーマのプライマリ色は、そのページのヘッダーとボタンに使われる。

### API（`apps/server`）

- **ランタイム**：Node.js + TypeScript
- **API**：Fastify上のApollo Server
- **スキーマ**：`apps/server/src/typeDefs/schema.graphql`（リポジトリ内で唯一のGraphQLスキーマ）
- **データベース**：Supabase（PostgreSQL）。マイグレーションは `apps/server/supabase`。APIはSupabaseクライアントではなく、Postgres接続上のKyselyでクエリする
- **本番環境**：PM2で管理されるDockerコンテナ

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
3. APIがSupabase PostgreSQLデータベースに対してクエリを実行
4. 結果がインタラクティブな地図上に医療機関の詳細とともに表示される

## 関連資料

コードが従うルールは、モノレポ内のコードの近くにあります：

- `AGENTS.md`：リポジトリ全体に関するコントリビューターとコーディングエージェント向けのメモ
- `apps/server/docs/city-rules.md`：検索用の市区町村名の決め方
- `apps/server/docs/places-storage.md`：保存してよいGoogle Placesのデータ
