# 本番データベース

このページは、Find a DocのAWSアカウントにサインインできるメンテナー向けです。自分のPCから本番データを確認する方法と、バックフィルを実行する方法を説明します。AWSに詳しくなくても大丈夫です。AWSの操作は`pnpm db:prod`というコマンド1つで行います。

!!! warning "実在の患者とクリニックのデータです"
    本番には予約リクエストや健康情報があります。[`AGENTS.md`](https://github.com/ourjapanlife/findadoc-monorepo/blob/main/AGENTS.md)のSecurityのルールに従ってください。行をPC、スプレッドシート、Issue、プルリクエスト、チャットにコピーしないでください。件数を数えて確認するだけにし、エクスポートはしません。

## 仕組み

データベースはインターネットに公開されていません。`pnpm db:prod`は次のことを行います。

1. AWSにサインインしているか確認します。
2. 非公開ネットワーク内の小さな踏み台サーバーが停止していれば起動します（約1分）。
3. PCの`127.0.0.1:15432`からデータベースまで暗号化されたトンネルを開きます。
4. AWSが発行する、15分で失効するパスワードでサインインします。

保管したり漏れたりするデータベースのパスワードはありません。踏み台サーバーは、最後の接続が切れてから20分後に自動で停止します。

データベースのロールは2つです。

| ロール | できること | 使う場面 |
| --- | --- | --- |
| `readonly`（既定） | ディレクトリのテーブルを読む | データの確認、件数の確認、バックフィルのドライラン |
| `operator` | ディレクトリのテーブルの行を読み書きする | 承認されたバックフィルの実行 |

どちらのロールもスキーマは変更できません。予約リクエスト、アップロード、予約枠、クリニックの招待、ユーザープロフィール、監査ログも見られません。スキーマの変更は必ずマイグレーションで行います。

## 初回の準備

必要なもの：

- [コードの実行](running-the-code.md)のとおりに準備したリポジトリ
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- `psql`（macOSでは`brew install libpq`を実行し、表示される案内に従って`PATH`に追加）
- Find a DocのAWSサインイン。AWSアクセスポータルへの招待をメンテナーに依頼してください。

AWSのプロファイルを一度だけ作成します。

```bash
aws configure sso --profile findadoc
```

質問には次のように答えます。

| 質問 | 回答 |
| --- | --- |
| SSO session name | `findadoc` |
| SSO start URL | `https://findadoc.awsapps.com/start` |
| SSO region | `ap-northeast-1` |
| SSO registration scopes | `sso:account:access` |
| Account | `677501681118` |
| Role | `AdministratorAccess` |
| Default client region | `ap-northeast-1` |
| Default output format | `json` |

## サインイン

サインインはおよそ1日有効です。サインインしていないと表示されたら、次を実行します。

```bash
aws sso login --profile findadoc
```

ブラウザが開くので、そこで承認します。

`pnpm db:prod`は、`AWS_PROFILE`で別のプロファイルを指定しない限り`findadoc`プロファイルを使います。

## データを見る

クエリを1つ実行します。トンネルは実行前に開き、実行後に閉じます。

```bash
pnpm db:prod psql -c "select verification_status, count(*) from facilities group by 1"
```

対話式の`psql`を開きます。

```bash
pnpm db:prod psql
```

### GUIで見る（TablePlus、DBeaver、pgAdmin）

ターミナルでトンネルを開いたままにします。

```bash
pnpm db:prod
```

入力する設定が表示されます。

| 項目 | 値 |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `15432` |
| Database | `postgres` |
| User | `findadoc_readonly` |
| Password | 表示されたトークン。そのターミナルでEnterを押すと新しいトークンが出ます。 |
| SSL | `require` |

トークンで新しく接続できるのは15分間です。すでに開いている接続はそのまま使えます。Instance Connectのトンネルは最長1時間です。その後は`pnpm db:prod`をもう一度実行してください。

## バックフィルを実行する

バックフィルは`apps/server/utils/`にある一度きりのスクリプトです。書き込みを指示しない限り何も変更しません。`pnpm db:prod`はコマンドを`apps/server`で実行するので、スクリプトは`node`で呼び出します（Windowsでは`pnpm db:prod pnpm …`が`pnpm`を起動できません）。手順は常に同じです。

**1. ドライラン**を読み取り専用ロールで実行し、表示された件数を確認します。

```bash
pnpm db:prod node --loader ts-node/esm utils/<script>.ts
```

1行目に接続先が表示されます：`[dry-run] PRODUCTION database as findadoc_readonly`

**2. 書き込み**をoperatorロールで実行します。本番への書き込みには`--write`と`--confirm-production`が必要です。

```bash
pnpm db:prod --role operator node --loader ts-node/esm utils/<script>.ts --write --confirm-production
```

**3. もう一度ドライラン**を実行し、変更が残っていないことを確認します。

Google Places APIを呼ぶスクリプトにはAPIキーが必要です。`--places-key`を付けると、そのコマンドの実行中だけAWSからキーを読み込みます。

```bash
pnpm db:prod --places-key node --loader ts-node/esm utils/<script>.ts
```

市区町村、Place ID、Mapsリンク、資格、電話番号、保険のバックフィルは2026年11月に本番で実行し、削除しました。新しいバックフィルは`apps/server/utils/scriptDatabase.ts`を使って書き、実行後に削除します。

実行待ちのインポートが1つあります。多言語対応医療機関リスト（`utils/importInstitutionList.ts`、#21）です。スプレッドシートの全行をステージングし、掲載済みの施設は空の項目だけを埋め、残りは未確認の施設として追加します。`--places-key`、`--input`ファイル、`utils/checkInstitutionList.py`が作る`--evidence`ファイルが必要です。このスクリプトは各行を厚生労働省のオープンデータ、日本郵便の郵便番号、医療機関のウェブサイトと照合します。手順は[`apps/server/docs/institution-import.md`](https://github.com/ourjapanlife/findadoc-monorepo/blob/main/apps/server/docs/institution-import.md)にあります。

## Claude Codeなど、AIアシスタントと使う

リポジトリには、Claude Codeのスキル`.claude/skills/production-database/SKILL.md`と、`pnpm db:prod`を実行する前に毎回確認するプロジェクト設定が入っています。「本番で、市区町村が未設定の公開施設はいくつ？」「本番で市区町村のバックフィルを実行して」のように、普通の言葉で頼んでください。アシスタントは次のように動きます。

- 書き込みを頼まれない限り、読み取り専用ロールを使います。
- 先にドライランを実行して件数を見せ、書き込む前に確認を求めます。
- 名前やメールアドレスなどの個人データをチャットに表示しません。

サインインを求められたら、Claude Codeのプロンプトに`! aws sso login --profile findadoc`と入力します。

ほかのアシスタントも同じスキルファイルを読めます。ただのMarkdownです。

## オプション

| オプション | 意味 |
| --- | --- |
| `--role readonly` / `--role operator` | データベースのロール。既定は`readonly`です。 |
| `--port <number>` | ローカルのポート。既定は`15432`です。トンネルを2つ開くときは別の番号にします。 |
| `--places-key` | コマンドに`GOOGLE_API_KEY`を設定します。 |
| `--help` | ヘルプを表示します。 |

## トラブルシューティング

| メッセージ | 対処 |
| --- | --- |
| `You are not signed in to AWS` | `aws sso login --profile findadoc` |
| `Port 15432 is in use` | 別の`pnpm db:prod`が開いています。閉じるか、`--port 15433`を付けます。 |
| `Waiting for the jump host to accept SSH` | 起動直後は正常です。約1分間再試行します。 |
| `permission denied for table ...` | そのテーブルは意図的に閉じています。メンテナーに相談してください。 |
| `cannot execute ... in a read-only transaction` | 読み取り専用ロールを使っています。書き込みには`--role operator`が必要です。 |
| `The tunnel closed` | トンネルは最長1時間です。もう一度実行してください。 |

この仕組みのインフラは、[`infra/README.md`](https://github.com/ourjapanlife/findadoc-monorepo/blob/main/infra/README.md)の`FindadocOperatorAccess`です。
