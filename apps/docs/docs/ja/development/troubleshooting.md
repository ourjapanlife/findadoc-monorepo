# トラブルシューティング

## よくある問題

### Node.jsのバージョン

モノレポは `.nvmrc` で **Node.js 24.22.0** に固定しています。バージョンを確認してください：

```bash
node --version
```

[nvm](https://github.com/nvm-sh/nvm)または[fnm](https://github.com/Schniz/fnm)の使用を推奨します。リポジトリのルートで：

```bash
nvm install
nvm use
```

### `Unable to find package manager binary`

選択したNodeのバージョンで`turbo`がpnpmを見つけられません。新しいNodeに`nvm use`で切り替えたら、その都度有効化してください：

```bash
corepack enable
corepack prepare pnpm@10.27.0 --activate
```

### OneDrive内でインストールが失敗する

同期フォルダではpnpmのファイルリンクが失敗することがあります。コピーでインストールしてください：

```bash
pnpm install --config.package-import-method=copy
```

### ポートが使用中

ポート3000または4000が使用中で`pnpm dev`が失敗する場合：

```bash
# ポート3000を使用しているプロセスを検索
lsof -i :3000

# プロセスを終了
kill -9 <PID>
```

### GraphQLの型エラー

新しい変更をプルした後に型エラーが発生した場合は、共有GraphQL型を再生成・再ビルドしてください：

```bash
pnpm generate
pnpm --filter @findadoc/graphql build
```

### ESLintエラー

自動修正付きでリンターを実行してください：

```bash
pnpm lint:fix
```

### ロケールキーのチェックが失敗する

`pnpm typecheck`はすべてのロケールファイルを`en.json`と比較します。不足・余分なキーを確認するには、チェックだけを実行してください：

```bash
pnpm lint:locales
```

翻訳を追加してください。英語の文をほかのロケールにコピーしないでください。

### ローカルデータベースの問題（API）

ローカルデータベースが起動しない場合は、Dockerが起動していることを確認してから：

```bash
pnpm check:db
pnpm db:reset
pnpm db:seed
```

ローカルデータベースが最新のマイグレーションより古いと、APIが`INTERNAL_SERVER_ERROR`を返すことがあります。リセットしてシードしてください。

古いローカルSupabaseがまだ動いている場合は、ポート54322を使っています。`pnpm db:start` がそのことを表示します。リセットやシードの前に止めてください。止めないと、これらのコマンドは `findadoc-db` ではなくそのデータベースを書き換えます。[ポート54322が使われている](running-the-code.md#port-taken)を参照してください。

### ドキュメントのチェックが失敗する

`pnpm lint:docs`は、ページに日本語訳がない、リンクが切れている、コマンドやバージョンがモノレポと一致しない場合に失敗します。メッセージにファイル名と行番号が表示されます。[ドキュメントの書き方](../contributing/docs.md)を参照してください。

## ヘルプが必要な場合

困ったときは、気軽に助けを求めてください：

- **Slack**：[#dev-team](https://find-a-doc.slack.com/join/shared_invite/zt-2lb3j2t1z-O9F4thzcFktqsIXNzzjzHw#/shared-invite/email)チャンネルに投稿
- **GitHub**：[Issue](https://github.com/ourjapanlife/findadoc-monorepo/issues)を作成するか、既存のIssueにコメント
