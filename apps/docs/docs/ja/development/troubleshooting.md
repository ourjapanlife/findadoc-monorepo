# トラブルシューティング

## よくある問題

### Node.jsバージョン

Find a Docには**Node.js >= 22.12.0**が必要です。バージョンを確認してください：

```bash
node --version
```

Node.jsのバージョン管理には[nvm](https://github.com/nvm-sh/nvm)または[fnm](https://github.com/Schniz/fnm)の使用をお勧めします：

```bash
nvm install 22
nvm use 22
```

### Yarn / Corepackの問題

プロジェクトはCorepack経由でYarn 4.xを使用しています。Yarnエラーが発生した場合：

```bash
corepack enable
corepack prepare yarn@4 --activate
```

### ポートが使用中

`yarn dev`がポート3000が使用中で失敗する場合：

```bash
# ポート3000を使用しているプロセスを検索
lsof -i :3000

# プロセスを終了
kill -9 <PID>
```

または別のポートで開発サーバーを起動：

```bash
npx nuxi dev --port 3001
```

### GraphQL型生成エラー

新しい変更をプルした後に型エラーが発生した場合、GraphQL型を再生成してください：

```bash
yarn generate
```

### ESLintエラー

自動修正でリンターを実行：

```bash
yarn lint:fix
```

### Supabaseの問題（バックエンド）

ローカルのSupabaseインスタンスが起動しない場合：

```bash
# Dockerが起動していることを確認してから：
npx supabase start
npx supabase db reset
```

## ヘルプが必要な場合

困ったときは、気軽に助けを求めてください：

- **Slack**：[#dev-team](https://find-a-doc.slack.com/join/shared_invite/zt-2lb3j2t1z-O9F4thzcFktqsIXNzzjzHw#/shared-invite/email)チャンネルに投稿
- **GitHub**：Issueを作成するか、既存のIssueにコメント
