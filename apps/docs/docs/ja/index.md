# Find a Doc, Japanへようこそ！

これは、自分の言語で医療サービスを見つけるためのクラウドソーシング型プラットフォームです。

ぜひプロジェクトをご覧ください。参加も大歓迎です！私たちは、日本に住む人々の生活を向上させるプロダクトの開発に取り組むNPO法人です。

**なぜこのプロジェクトが存在するのか？** あなたや友人が医者を探す必要があったけど、日本語が流暢ではなかった経験はありませんか？日本を訪れていて、すぐに助けが必要な場合もあるかもしれません。このプロジェクトは、自分の言語で医療サービスを見つけるためのクラウドソーシング型ウェブサイトです。

チームや歴史について詳しくは、[アバウトページ](https://www.findadoc.jp/about)をご覧ください。

!!! info "医療サービスをお探しですか？"
    このサイトは**開発者およびコントリビューター向け**です。患者として自分の言語で医療を探している方、または医療従事者として施設を掲載したい方は、[findadoc.jp](https://www.findadoc.jp)をご覧ください。

---

## 参加する

**開発、デザイン、翻訳、法務、マーケティング**など、スキルを活かして貢献したいすべての方を歓迎します。お手伝いいただける方は、ぜひご参加ください。

1. [Slack](https://find-a-doc.slack.com/join/shared_invite/zt-2lb3j2t1z-O9F4thzcFktqsIXNzzjzHw#/shared-invite/email)に参加し、**#general**または**#dev-team**で自己紹介してください
2. [はじめに](getting-started/index.md)ガイドをご覧ください
3. [Issue](https://github.com/ourjapanlife/findadoc-monorepo/issues)を選んで貢献を始めましょう

## リポジトリ

すべてのソフトウェアはオープンソースで、1つのモノレポ [findadoc-monorepo](https://github.com/ourjapanlife/findadoc-monorepo) にあります。

| パス | 説明 |
|------|-------------|
| `apps/web` | [findadoc.jp](https://www.findadoc.jp) のウェブサイト (Nuxt 4 / Vue 3) |
| `apps/server` | GraphQL API (Node.js / Apollo Server / PostgreSQL on AWS) |
| `apps/mcp` | AI連携用MCPサーバー |
| `apps/docs` | このドキュメントサイト |
| `packages/graphql` | APIスキーマから生成したTypeScript型 |
| `packages/utils` | サイトとAPIで共有するチェックとヘルパー |

## Slackの主要チャンネル

| チャンネル | 目的 |
|---------|---------|
| **#general** | 自己紹介と一般的なディスカッション |
| **#dev-team** | 開発に関する質問と調整 |
| **#localization** | 翻訳と国際化 |
