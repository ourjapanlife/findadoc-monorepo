# コードの実行

すべてのコードは1つのリポジトリ [findadoc-monorepo](https://github.com/ourjapanlife/findadoc-monorepo) にあります。[Turborepo](https://turborepo.com/)で動かすpnpmワークスペースです。ルートで一度インストールし、すべてのタスクをルートから実行します。

## 前提条件

- **Node.js** 24.22.0（`.nvmrc`で固定。[nvm](https://github.com/nvm-sh/nvm)または[fnm](https://github.com/Schniz/fnm)を推奨）
- **pnpm** 10.27.0（[Corepack](https://nodejs.org/api/corepack.html)経由）
- **Docker**（APIのローカルPostgresデータベースにのみ必要）
- **Python** 3.10以上（このドキュメントサイトにのみ必要）

**推奨IDEプラグイン**（VS Code）：

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Vue Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## クローンとインストール

`nvm use`でNodeを切り替えます。`pnpm`や`turbo`を実行する前に、そのNodeでpnpmを有効化してください。Windowsではこの手順が必須です。

```bash
git clone https://github.com/ourjapanlife/findadoc-monorepo.git
cd findadoc-monorepo
nvm use
corepack enable
corepack prepare pnpm@10.27.0 --activate
pnpm install
```

`pnpm install`はHuskyも設定し、コミット前にリンティングが実行されます。

リポジトリがOneDrive内にある場合、pnpmのファイルリンクが失敗することがあります。その場合はコピーでインストールしてください：

```bash
pnpm install --config.package-import-method=copy
```

## すべてを起動する

```bash
pnpm dev
```

ウェブサイト、ローカルデータベースに接続したGraphQL API、MCPサーバーが起動します。その他の起動方法：

| コマンド | 起動するもの |
|---------|----------------|
| `pnpm dev` | サイト、ローカルAPI、MCPサーバー |
| `pnpm dev:web` | サイトとローカルAPI（MCPサーバーなし） |
| `pnpm dev:seeded` | ローカルデータベースをリセット・シードしてから、サイトとAPI |
| `pnpm dev:api` | サイトのみ（本番API `https://api.findadoc.jp` に接続） |
| `pnpm dev:server` | ローカルAPIのみ |
| `pnpm dev:mcp` | STDIOのMCPサーバー |
| `pnpm dev:mcp:http` | Streamable HTTPのMCPサーバー |

サイトは `http://localhost:3000`、APIは `http://127.0.0.1:4000` で動きます。

## ウェブサイト（`apps/web`）

### モデレーションダッシュボード

モデレーションダッシュボードにはローカルAPIが必要です：

1. サイトとAPIを起動：`pnpm dev:seeded`
2. `http://localhost:3000/login` にアクセス
3. ユーザー名とパスワードを入力 — 認証情報はSlackでコアメンテナーにお問い合わせください

### クリニックの独自ページ

独自ページを持つクリニックは `clinic_sites` の1行で、種データは `apps/server/scripts/seed/clinicSiteContent.ts` です。最初のページは `/clinic/multilingual-online-clinic` です。ディレクトリの施設ができるまで、施設idは空です。アカウントは `clinic_memberships` で紐づけます。`pnpm dev` は Turbo で、ローカルAPIへ接続します。`/clinic/multilingual-online-clinic?preview=1` を開くと、30日間有効なCookieが保存されます。CookieがないURLは404で、`noindex` になり、サイトマップにも入りません。`?preview=0` でCookieを消します。環境変数はありません。ページを読むために、種データを入れたAPIを起動します。

ポスターに載せるリンクは `https://multilingual-online-clinic.findadoc.jp/` です。クリニックのパンくず、`/clinic/multilingual-online-clinic`、`--{id}` で終わるディレクトリのURLはそこへ転送されます。共有時の画像はそのクリニックのアイコンです。フッターは Find a Doc のロゴと「Powered by Find a Doc, Japan」だけです。ヘッダーには、そのクリニックが保存したブランドカラーを使います。予約ボタンはまだどこにも飛びません。予約の流れはあとからこのボタンを置き換えます。病院の管理者は、これまでどおり施設そのものを編集します。

同じページは2つのホストで開きます。種データを入れたAPIとサイトは、次のコマンドで起動します。

```bash
pnpm dev:seeded
```

- ドメインのパス: `http://127.0.0.1:3000/clinic/multilingual-online-clinic?preview=1`
- クリニックのホスト名: `http://multilingual-online-clinic.localhost:3000/?preview=1`

ブラウザは `*.localhost` をこのマシンに解決するので、hosts ファイルは要りません。ホスト名そのものがクリニックです。`http://multilingual-online-clinic.localhost:3000/` は `/` のままです。そのホストの他のページ、`/submit` と `/clinic/multilingual-online-clinic` も含めて、`/` へ転送されます。画像とスクリプトはそのままです。プレビューのCookieは、それを保存したホストにだけ付きます。それぞれのホストで `?preview=1` が必要です。`?preview=0` はそのホストのCookieを消します。正規URLはサブドメインです。

`www`、`api`、`mcp`、`docs` はクリニックのホストではありません。`admin.localhost` と `admin.findadoc.jp` はスタッフ用サイトで、クリニックのホストではありません。

正規URLは `https://{slug}.findadoc.jp/` です。www のパスと共有用の id は別の入口で、どちらもそのホストへ転送されます。

### スタッフ用サイト

`http://admin.localhost:3000/?preview=1` を開くと、30日間のCookieが保存され、`/admin` へ転送されます。Cookieがないとそのホストは404です。`?preview=0` でCookieを消します。そのホストの他のページ、`/submit` も含めて、`/admin` へ転送されます。ページは `noindex` のままです。人を追加するには、これまでどおりログインが必要です。環境変数はありません。

病院は基本プランから始まり、有効な人は3人までです。Find a Doc のスタッフ（`write:users`）は、オーナーまたはスタッフを追加でき、その病院に既に所属する医療者を席に結びつけられます。その病院のオーナーは、3席の範囲でスタッフの追加と解除ができます。解除しても行は残り、監査ログが書かれます。最初のオーナーは Find a Doc のスタッフが追加します。

### Amplify と Route 53

DNSゾーンは Route 53 のままにします。ネームサーバーは変えません。Amplify は本番ブランチで `*.findadoc.jp` を既に配信しているので、クリニックのホスト名はそのワイルドカードです。`*` は `findadoc.jp` そのものを含みません。`www`、`api`、`mcp`、`docs` に既にあるレコードは `*` より具体的なので、そのままです。`admin.findadoc.jp` はその `*` レコードに含まれます。クリニックのスラッグは変わりません。

### Storybook

```bash
pnpm --filter @findadoc/web storybook
```

Storybookは `http://localhost:6006` で利用できます。

### 本番ビルド

```bash
pnpm --filter @findadoc/web build
```

サイトを `apps/web/.output/public` にプリレンダリングします。

## API（`apps/server`）

!!! note
    APIのローカルPostgresデータベースにはDockerが必要です。起動していなければ `pnpm db:reset` が起動します。

```bash
pnpm db:start            # ローカルのPostgresデータベースをDockerで 127.0.0.1:54322 に起動
pnpm check:db            # ローカルデータベースが 127.0.0.1:54322 で動いているか確認
pnpm db:reset            # ローカルデータベースを削除して再作成し、すべてのマイグレーションを適用
pnpm db:seed             # シードデータを投入
pnpm dev:server          # APIを起動
```

### デバッグ

VS CodeでAPIをデバッグできます：**Run and Debug**タブを開き、**JavaScript Debug Terminal**を選択し、そのターミナルで`pnpm dev:server`を実行してください。デバッガーが自動的に接続されます。行番号をクリックしてブレークポイントを追加してください。

### Apollo Explorerでのテスト

APIが `http://127.0.0.1:4000` で起動したら：

1. メニューから**Explorer**セクションに移動
2. 「Root Types」の下にある**query: Query**をクリック
3. **+**ボタンをクリックして利用可能なフィールドを表示
4. フィールドを選択してクエリビルダーに追加
5. IDが必要な型（例：`Facility`や`HealthcareProfessional`）の場合、**Variables**ウィンドウにIDを文字列として追加

## MCPサーバー（`apps/mcp`）

```bash
pnpm dev:mcp             # STDIO（Claude CodeとMCP Inspector用）
pnpm dev:mcp:http        # Streamable HTTP
pnpm --filter @findadoc/mcp build
```

ツール一覧とクライアントの設定は `apps/mcp/README.md` を参照してください。

## GraphQLの型

`apps/server/src/typeDefs/schema.graphql` が唯一のスキーマです。サイト、API、MCPサーバーは、そこから生成された型を `@findadoc/graphql` 経由でインポートします。スキーマを変更したら型を再生成し、`packages/graphql/src/index.ts` をコミットしてください：

```bash
pnpm generate
pnpm --filter @findadoc/graphql build
```

コミットされた型がスキーマと一致しない場合、CIが失敗します。

## リンティングとテスト

```bash
pnpm lint                # すべてのパッケージ
pnpm lint:fix
pnpm typecheck           # ロケールキーのチェックを含む
pnpm test                # web、MCP、utilsのユニットテスト
pnpm test:server         # APIのテスト（ローカルデータベースが必要）
pnpm test:e2e            # ウェブサイトのPlaywright
```

1つのパッケージのタスクだけを実行するには `--filter` を使います：

```bash
pnpm --filter @findadoc/web test:unit
```

## ドキュメントサイト（`apps/docs`）

このサイトは[Zensical](https://zensical.org/)で構築されています。仮想環境に一度インストールしてください：

```bash
cd apps/docs
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

その後、仮想環境を有効にした状態でリポジトリのルートから：

```bash
pnpm docs                # http://127.0.0.1:8000 でプレビュー
pnpm docs:build          # apps/docs/site にサイトを出力
pnpm lint:docs           # ドキュメントがモノレポと一致しているか確認
```

これらのページをいつ・どのように更新するかは[ドキュメントの書き方](../contributing/docs.md)を参照してください。
