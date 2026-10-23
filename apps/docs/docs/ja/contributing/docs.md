# ドキュメントの書き方

このサイトはモノレポの `apps/docs` にあり、説明しているコードのすぐ隣に置かれています。ドキュメントが古くなる変更をしたら、同じPull Requestでドキュメントも更新してください。

## ドキュメントを更新するタイミング

次のような変更をするPull Requestでは、ドキュメントも更新してください：

- コントリビューターが実行する`pnpm`スクリプトを追加・名前変更・削除する
- Node.jsまたはpnpmのバージョンを変更する
- アプリやパッケージを追加・削除・名前変更する
- セットアップ、実行、テスト、デプロイの方法を変更する
- [技術スタック](../development/tech-stack.md)の技術を置き換える
- [アーキテクチャ](../development/architecture.md)やコントリビューションの流れを変更する

Pull Requestのテンプレートで、この確認を求めています。

## ページの構成

- 英語のページは `apps/docs/docs/` にあります（例：`development/tech-stack.md`）
- 日本語のページは `apps/docs/docs/ja/` 以下に同じパスで置きます（例：`ja/development/tech-stack.md`）
- ナビゲーションは `apps/docs/mkdocs.yml` の `nav:` で定義します

ページを追加したら、`nav`に追加し、日本語のページも書いてください。日本語が書けない場合は、Slackの**#localization**で相談してください。

## 変更の確認

リポジトリのルートでサイトをプレビューし、ドキュメントのチェックを実行してください（初回の準備は[コードの実行](../development/running-the-code.md#appsdocs)を参照）：

```bash
pnpm docs
pnpm lint:docs
```

`pnpm lint:docs`は次の場合に失敗します：

- 英語のページに日本語のページがない、またはその逆
- ページが`nav`に載っていない
- 相対リンクの先にファイルがない
- コードブロック内の`pnpm`コマンドが、どのパッケージにもないスクリプトを指している
- Node.jsやpnpmのバージョンが`.nvmrc`や`packageManager`と一致しない
- コードブロックでYarn、`npm run`、`npx`を使っている、または廃止された単体アプリのリポジトリにリンクしている

**Docs**ワークフローは、すべてのPull Requestでこのチェックとフルビルドを実行します。コードだけを変更したPull Requestでも実行されるため、スクリプト名を変更するとドキュメントを更新するまで失敗します。

## 公開

`apps/docs` の変更が `main` にマージされると、**Docs**ワークフローがサイトをビルドし、GitHub Pagesの [docs.findadoc.jp](https://docs.findadoc.jp) にデプロイします。
