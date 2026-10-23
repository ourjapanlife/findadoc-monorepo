# コントリビューションワークフロー

## 作業を見つける

1. モノレポの[Issue](https://github.com/ourjapanlife/findadoc-monorepo/issues)を閲覧
2. Slackの**#dev-team**に参加して、手伝いたいことを伝えてください
3. 作業を始める前にIssueを自分にアサインしてください

## 変更を加える

1. [findadoc-monorepo](https://github.com/ourjapanlife/findadoc-monorepo)をクローンし、`main`からブランチを作成 — ユーザー名をプレフィックスに：`yourusername/my-change`
2. 変更を加える。セットアップ、実行、ビルドの方法が変わる場合は、ドキュメントも更新してください（[ドキュメントの書き方](docs.md)を参照）
3. リンティングとテストを実行してすべてパスすることを確認：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Pull Requestの提出

1. ブランチをプッシュしてGitHubでPRを作成
2. 変更内容とテスト方法を明確に記述
3. PRの担当者として自分をアサインし、適切なラベルを追加

### PRの要件

- PRタイトルは[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary)に従うこと（例：`feat: add search filter`、`fix: correct map marker position`）
- すべての自動チェックとリンターがパスすること
- PR説明にテスト手順を含めること
- 変更によってページが古くなる場合は `apps/docs` を更新すること

## コードレビュー

メンテナーがPRをレビューし、変更を求める場合があります。承認されたらチームがマージします。

## 行動規範

[行動規範](code-of-conduct.md)を読み、遵守してください。私たちは歓迎的で包括的なコミュニティの提供に尽力しています。
