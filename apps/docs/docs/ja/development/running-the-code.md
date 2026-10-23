# コードの実行

## 前提条件

- **Node.js** >= 22.12.0（[nvm](https://github.com/nvm-sh/nvm)または[fnm](https://github.com/Schniz/fnm)を推奨）
- **Yarn** 4.x — [Corepack](https://nodejs.org/api/corepack.html)で有効化：

```bash
corepack enable
```

**推奨IDEプラグイン**（VS Code）：

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Vue Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## ドキュメントサイト (findadoc-docs)

### クローンとインストール

```bash
git clone https://github.com/ourjapanlife/findadoc-docs.git
cd findadoc-docs
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 開発サーバーの起動

```bash
zensical serve
```

サイトは `http://127.0.0.1:8000` で利用できます。

### ビルド

```bash
zensical build --clean
```

## フロントエンド (findadoc-web)

### クローンとインストール

```bash
git clone https://github.com/ourjapanlife/findadoc-web.git
cd findadoc-web
yarn install
```

### Gitフックの設定

```bash
yarn prepare
```

Huskyを設定し、コミット前にリンティングを自動実行します。

### 開発サーバーの起動

```bash
yarn dev
```

サイトは `http://localhost:3000` で利用できます。

### ローカルAPIとの接続

ローカルで実行中のバックエンドに接続する場合：

```bash
yarn dev:localserver
```

### モデレーションダッシュボード

モデレーションダッシュボードにはローカルで実行中のバックエンドが必要です：

1. バックエンドを起動する（下記の[バックエンド](#バックエンド-findadoc-server)セクションを参照）
2. ローカルAPI用にフロントエンドを起動：`yarn dev:localserver`
3. `http://localhost:3000/login` にアクセス
4. ユーザー名とパスワードを入力 — 認証情報はSlackでコアメンテナーに連絡してください

### GraphQL型の生成

GraphQL APIのTypeScript型は自動生成されます。新しい変更をプルした後やAPIスキーマが更新された場合に実行してください：

```bash
yarn generate
```

`gqlTypes.ts`ファイルが生成されます。追加のカスタムTypeScript型は`./typedefs`フォルダに配置してください。

### リンティング

```bash
yarn lint        # 問題をチェック
yarn lint:fix    # 問題を自動修正
```

### テスト

```bash
# ユニットテスト
yarn test:unit

# E2Eテスト（Cypress GUIを開く）
yarn test:e2e

# E2Eテスト（ヘッドレス）
yarn test:e2e:headless
```

### Storybook

```bash
yarn storybook
```

Storybookは `http://localhost:6006` で利用できます。

### プロダクションビルド

```bash
yarn prod:build
```

## バックエンド (findadoc-server)

!!! note
    バックエンドにはDockerとSupabase CLIが必要です。

### クローンとインストール

```bash
git clone https://github.com/ourjapanlife/findadoc-server.git
cd findadoc-server
yarn install
```

### 開発サーバーの起動

Supabaseの起動、データベースのシード、型の生成、開発サーバーの起動を行います：

```bash
yarn dev
```

### デバッグ

VS Codeでバックエンドをデバッグできます：**Run and Debug**タブを開き、**JavaScript Debug Terminal**を選択し、そのターミナルで`yarn dev`を実行してください。デバッガーが自動的に接続されます — 行番号をクリックしてブレークポイントを追加するだけです。

### Apollo Explorerでのテスト

サーバーが `http://localhost:4000` で実行中の場合：

1. メニューから**Explorer**セクションに移動
2. 「Root Types」の下にある**query: Query**をクリック
3. **+**ボタンをクリックして利用可能なフィールドを表示
4. フィールドを選択してクエリビルダーに追加
5. IDが必要な型（例：`Facility`や`HealthcareProfessional`）の場合、**Variables**ウィンドウにIDを文字列として追加

### テスト

```bash
yarn test
```

### リンティング

```bash
yarn lint
```

## MCPサーバー (findadoc-mcp)

### クローンとインストール

```bash
git clone https://github.com/ourjapanlife/findadoc-mcp.git
cd findadoc-mcp
yarn install
```

### 開発

```bash
yarn dev
```

### ビルド

```bash
yarn build
```

### テスト

```bash
yarn test
yarn test:watch
```
