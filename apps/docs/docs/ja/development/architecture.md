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
- **状態管理**：UIの状態（フィルター、モーダル、未保存の編集）だけを持つPiniaストア
- **サーバーデータ**：TanStack Query（`@tanstack/vue-query`）。下の「ウェブアプリのデータ取得」を参照
- **API**：`graphql-request`によるGraphQL
- **認証**：Auth0（モデレーションダッシュボード用）
- **地図**：Google Maps API（医療機関の位置表示）
- **国際化**：Nuxt i18n（13言語対応）。クリニック、医師、ハブ、ファセットのページは英語と日本語でプリレンダリング
- **クリニックの独自ページ**：独自ページは `clinic_sites` の1行。アカウント（`clinic_memberships`）と、これからのCRMが紐づくのはこのid。ショーケースのディレクトリ施設は `c32c316a-a368-499b-abaf-c5c973cb67e5` です。このページに市区町村がないので、種データのその行は未確定のままです。共有するURLは `https://{slug}.findadoc.jp/` です。そのホストの `/` でクリニックを開きます。予約は常に Find a Doc 本体の `/book/{facilityId}` です（クリニックホストの `/book` はそこへ転送します）。独自ページが無いディレクトリのクリニックも同じURLです。フォームの項目は Find a Doc が持ち、クリニックは 15・30・45・60 分の診察時間、日本時間の週の診療時間、臨時の受付時間、休診を持ちます。任意のクエリは `duration`、`start`、`practitioner`、`form`、`service` です。送信内容・S3（またはローカル）アップロード・設定時のSES通知を保存します。空き枠は、週の診療時間と臨時の受付時間から、休診と押さえ済みの予約を引いたものです（`apps/server/docs/booking-access.md`）。スタッフは週の診療時間を「設定」で決め、FullCalendar で休診日や時間帯を閉じます。どちらもクリニック全体か医師1人ごとに設定でき、自分の時間を持つ医師は別々に予約を受けます。患者は言語で絞り込み、医師（または誰でも）を選び、選んだ時間の長さに合う開始時刻を選びます。開始時刻は、クリニックが15分か45分の診察を提供していれば15分ごと、そうでなければ各医師の開始時刻から30分ごとです（`slotStepMinutes`）。APIはその刻みに合わない開始時刻を受け付けません。マイページの予約一覧は閲覧のみで、回答の編集はありません。本人確認・保険のアップロードには短い `retain_until` があり、Lambda `findadoc-booking-purge` が毎日削除します。同じ Lambda が予約の回答を受診から90日後に消し、キャンセルやお断りではその時点で消します。キャンセルやお断りのメモは、受診か状態の変更のどちらか早い方から90日後に消します（`apps/server/docs/booking-retention.md`）。投稿のメモ（`submissions.notes`）も、モデレーターの判断から180日後、判断がなければ送信から365日後に消し、監査ログにはメモを残しません（`apps/server/docs/submission-retention.md`）。予約フォーム、空き枠、アップロード、送信にサインインは不要です。ただし `CLINIC_LANDING_MODE` が `preview` の間、予約ページはクリニックの独自ページと同じ `?preview=1` のCookieの後ろにあります。Cookieが無いと `/book/{facilityId}` は404で、ディレクトリのクリニックページの予約ボタンはブラウザでだけ追加するため、プリレンダーしたHTMLには入りません。患者の `/book/manage` リンクは制限しません。予約一覧と空き枠カレンダーはサインインしたセッションが必要です。独自ページには Find a Doc のヘッダーがなく、Find a Doc の「Powered by」フッターだけです。正規URLはそのサブドメインです。DNSは Route 53 のままです。`?preview=1` がCookieを保存します。Cookieが無いページは404で、noindex のまま、サイトマップにも入りません。環境変数はありません。クリニックのパンくず、`/clinic/{slug}`、`/clinic/{prefecture}/{city}/{slug}--{id}` はそこへ転送します。リンクのプレビュー画像はそのクリニックのアイコン。保存したテーマのプライマリ色は、そのページのヘッダーとボタンに使われる。同じ `clinic_sites.theme` の jsonb にクリニックのブランドも入ります：`displayName`、`wordmark`（`ja` と `en`）、`logoPath`（`hero_path` と同じ静的パス。ロゴのアップロードはありません）。`BookingForm`、`BookingClinic`、`PatientBookingView` はそれを `branding` として返し、下書きでない独自ページが無ければ null です。`/book/{facilityId}`、`/book/manage`、`/clinic-dashboard/{facilityId}` は `clinic-branded` レイアウトを使います。ヘッダーにクリニックのロゴかワードマーク、ボタンにその色、フッターに「Powered by」です。ページの読み込み中と `branding` が null のときは Find a Doc のヘッダーとフッターに戻ります。ページの言語はクリニックごとに選びます。ページがあるのは `clinic_site_locales` に行があるサイト言語だけです。言語の切り替え、生成するHTML、サイトマップ、hreflang はその言語だけを出し、それ以外の言語のURLは英語のページへ転送します。

### API（`apps/server`）

- **ランタイム**：Node.js + TypeScript
- **API**：Fastify上のApollo Server
- **スキーマ**：`apps/server/src/typeDefs/schema.graphql`（リポジトリ内で唯一のGraphQLスキーマ）
- **データベース**：Supabase（PostgreSQL）。マイグレーションは `apps/server/supabase`。APIはSupabaseクライアントではなく、Postgres接続上のKyselyでクエリする
- **本番環境**：PM2で管理されるDockerコンテナ
- **キャッシュ**：`apps/server/src/publicCache.ts`がすべてのレスポンスに`Cache-Control`を付けます（#242）。トークンが送られておらず、ルートフィールドがすべて`PUBLIC_CACHEABLE_QUERY_FIELDS`にあり、エラーがないときだけ`public, max-age=60`になります。それ以外は`private, no-store`です。このリストに加えてよいのは、サインアウトしている訪問者全員に同じ答えを返すフィールドだけです。ユーザー、IP、国、トークン、レート制限を読まないものに限ります。予約、アップロード、モデレーション、ユーザーのフィールドは加えません。`__tests__/publicCache.test.ts`がリストを確認します
- **CSRF**：Apolloの組み込みチェックは無効にし、`csrfPreventionPlugin`が同じルールを守ります。プリフライトのないリクエスト（フォームのPOSTや、`x-apollo-operation-name`ヘッダーのないGET）が実行できるのは、公開リストにあるクエリだけです。そのため公開の読み込みは、キャッシュできる普通のGETで送れます
- **参照テーブル**：都道府県と市区町村の一覧は、Lambdaのメモリに10分間置きます（`src/lookupCache.ts`）
- **絞り込み用の語彙**：`specialties`、`specialtyCategories`、`languages` は、診療科、カテゴリ、言語のコードを英語と日本語のラベル付きで返します（#24）。クライアントはスキーマのイントロスペクションではなく、これらを読みます。`languages` は `publishedOnly` が false でない限り、検索ファセットの言語だけを返します。ラベルとカテゴリの対応表は `packages/utils` にあるため、これらのクエリはデータベースを読まず、公開リストに入っています
- **エッジ**：APIのCloudFrontディストリビューションは、APIが`public`と付けたGETだけをキャッシュします（`infra/lib/functionUrlEdge.ts`の`cachePublicReads`）。キャッシュキーはクエリ文字列、`Origin`、`Authorization`です。エラーのレスポンスはキャッシュしません。POST、OPTIONS、予約、サインイン中の読み込みは、常にAPIまで届きます。MCPサーバーも読み込みをGETで送るので、同じキャッシュを使います

### MCPサーバー（`apps/mcp`）

- **プロトコル**：Streamable HTTPとSTDIOによるModel Context Protocol
- **目的**：医療機関データをAIアシスタントに公開し、同じツールをRESTエンドポイントとしても提供

### 共有パッケージ

| パッケージ | 用途 |
|---------|---------|
| `packages/graphql` | `@findadoc/graphql`。スキーマから生成したTypeScript型。`pnpm generate`で再生成 |
| `packages/utils` | `@findadoc/utils`。サイトとAPIで共有するチェック、ヘルパー、診療科と言語の語彙 |
| `packages/tsconfig` | 共有TypeScript設定 |

## ウェブサイトのディレクトリ構成

| ディレクトリ | 用途 |
|-----------|---------|
| `apps/web/components/` | 再利用可能なVueコンポーネント |
| `apps/web/pages/` | ルートページ（Nuxtによる自動登録） |
| `apps/web/stores/` | Piniaストア（UIの状態） |
| `apps/web/i18n/locales/` | 翻訳ファイル（`en.json`と照合） |
| `apps/web/assets/` | 未コンパイルのアセット（CSS、画像、フォント） |
| `apps/web/typedefs/` | TypeScript型定義 |
| `apps/web/public/` | ルートで配信される静的ファイル（例：`robots.txt`） |

## データフロー

1. ユーザーが[findadoc.jp](https://www.findadoc.jp)で医療機関を検索
2. ウェブサイトがAPIにGraphQLクエリを送信
3. APIがSupabase PostgreSQLデータベースに対してクエリを実行
4. 結果がインタラクティブな地図上に医療機関の詳細とともに表示される


## ウェブアプリのデータ取得

ウェブアプリの読み込みはTanStack Queryに移行中です（#242）。今は検索ページが使っています。ほかのページは、移行するまでPiniaストアでデータを読み込みます。

- 読み込みはコンポーザブルの中の`useQuery`です（例：`apps/web/composables/useSearchDirectory.ts`）。`queryFn`は`apps/web/utils/queryClient.ts`の`requestQueryData`を呼びます。これは`graphQLClientRequestWithRetry`でリクエストを送り、vue-queryの中断シグナルを渡します。ページを離れると、そのリクエストは取り消されます。
- キーは`apps/web/utils/queryKeys.ts`で作ります。コンポーネントにキーの配列を直接書かないでください。書き込みは、変更したキーを無効にします。
- 既定値は`createAppQueryClient`にあります。クエリの再試行は1回だけで、タイムアウト、接続の切断、502/503/504のときに限ります。ミューテーションは再試行しません。
- ディレクトリの読み込みは5分間新しいものとして扱います（`DIRECTORY_STALE_TIME_MS`）。それ以外の読み込みはすぐに古くなるので、モデレーションと予約は毎回サーバーに問い合わせます。
- サインアウトするとキャッシュをすべて消します。サーバーデータはメモリにだけ置き、`localStorage`や`sessionStorage`には書きません。
- 読み込みはブラウザでだけ行います。プリレンダーされたページは読み込み中の状態で届き、そのあと読み込みます。
- `nuxi generate`は、すでに取得したディレクトリを`/_directory/search.json`に書き出します。すべてのページを取得できたときだけです。/searchは、APIが先に答えていなければ、このファイルをビルド時刻つきでクエリキャッシュに入れ、APIの答えで置き換えます。APIを待たずに結果が表示され、APIが止まっていても表示されます。ファイルの形を変えたら、`apps/web/utils/searchDirectorySnapshot.ts`の`SEARCH_DIRECTORY_SNAPSHOT_VERSION`を上げてください。
- APIの公開リスト（`PUBLIC_CACHEABLE_QUERY_FIELDS`）にある読み込みは、`apps/web/utils/graphql.ts`の`publicReadRequest()`か、`requestQueryData`の`publicRead: true`で送ります。ブラウザでは、トークンもカスタムヘッダーも付けないGETになり、CloudFrontとブラウザが60秒キャッシュできます。プリレンダーはPOSTのままなので、生成されるHTMLは新しいデータから作られます。ほかの操作をこの方法で送ると、APIは拒否します。

## 関連資料

コードが従うルールは、モノレポ内のコードの近くにあります：

- `AGENTS.md`：リポジトリ全体に関するコントリビューターとコーディングエージェント向けのメモ
- `apps/server/docs/city-rules.md`：検索用の市区町村名の決め方
- `apps/server/docs/places-storage.md`：保存してよいGoogle Placesのデータ
