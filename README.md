# 🌸 さくらスペース HR エージェントシステム

Claude claude-opus-4-6 を活用した社内HR問い合わせ自動対応システム。
従業員のHR手続きをAIエージェントが代行し、解決できない案件はオペレータに自動エスカレーションします。

---

## システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         ブラウザ                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │質問者画面 │  │オペレータ画面│  │監視画面  │  │管理者画面 │  │
│  │ /chat    │  │ /operator    │  │ /monitor │  │ /admin    │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └─────┬─────┘  │
└───────┼───────────────┼───────────────┼───────────────┼─────────┘
        │               │               │               │
        └───────────────┴───────┬───────┘               │
                                │ HTTP / WebSocket        │
                     ┌──────────▼──────────┐             │
                     │   nginx :5173       │             │
                     │  /api/*  → backend  │             │
                     │  /socket.io/* → ws  │             │
                     └──────────┬──────────┘             │
                                │                        │
                     ┌──────────▼──────────────────────┐ │
                     │      Backend :3001               │ │
                     │  Express + Socket.io             │◄┘
                     │                                  │
                     │  ┌─────────────────────────┐    │
                     │  │     HR Agent              │    │
                     │  │  claude-opus-4-6          │    │
                     │  │  - tool use               │    │
                     │  │  - extended thinking      │    │
                     │  └────────────┬──────────────┘    │
                     │               │ Tool calls         │
                     │  ┌────────────▼──────────────┐    │
                     │  │  Mock API                 │    │
                     │  │  SmartHR / ServiceNow     │    │
                     │  └───────────────────────────┘    │
                     └──────────────┬───────────────────-┘
                                    │ Prisma ORM
                     ┌──────────────▼───────────────────┐
                     │      PostgreSQL :5432             │
                     └──────────────────────────────────┘
```

---

## 機能概要

### 🤖 HR エージェント

- `/hr <質問>` コマンドで起動
- **SmartHR モック API** を通じて以下を自動処理：
  - 従業員情報の取得
  - 有給残日数の確認
  - 有給申請の提出
  - 打刻修正の申請
- **ServiceNow モック API** を通じて：
  - HRSD ケースの作成
  - ケースステータスの確認
- 解決できない場合は `escalate_to_operator` ツールでオペレータに自動通知
- Extended Thinking の内容をスーパーバイザー向け監視画面にリアルタイムストリーム

### 👥 ロール別画面

| ロール | 画面 | 主な機能 |
|--------|------|----------|
| USER | `/chat` | HRエージェントへの質問・有給申請・打刻修正依頼 |
| OPERATOR | `/operator` | 全チャット閲覧・エスカレーション対応・チャット参加 |
| SUPERVISOR | `/monitor` | エージェント思考プロセスのリアルタイム監視・ツール呼び出しログ |
| ADMIN | `/admin` | ユーザー管理・API権限のロール別ON/OFF設定 |

### 🔑 API権限管理

管理者画面からロール × API アクション単位で権限を動的に制御できます。
変更は即時反映され、次の会話からエージェントが使用するツールセットが切り替わります。

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| AI エンジン | Anthropic API (`claude-opus-4-6`) + `@anthropic-ai/sdk` |
| バックエンド | Node.js / Express / Socket.io / TypeScript |
| フロントエンド | React 18 / Vite / Tailwind CSS / Zustand |
| データベース | PostgreSQL 16 + Prisma ORM |
| 認証 | JWT (HS256) |
| インフラ | Docker Compose / nginx |

---

## Docker で起動する

### 前提条件

- Docker / Docker Compose がインストール済みであること
- Anthropic API キーを取得済みであること

### 手順

```bash
# 1. リポジトリをクローン
git clone <this-repo>
cd sakura-space

# 2. 環境変数を設定
cp .env.example .env
# .env を開いて ANTHROPIC_API_KEY を設定
#   ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# 3. ビルド & 起動
docker compose up --build
```

初回起動時に自動で以下が実行されます：

1. PostgreSQL の起動待機
2. DB スキーマの適用 (`prisma db push`)
3. 初期データのシード（ユーザー・権限）
4. バックエンドサーバー起動

→ `http://localhost:5173` でアクセス

### サービス構成

```
postgres   :5432   PostgreSQL 16（データ永続化: Dockerボリューム）
backend    :3001   Node.js API サーバー
frontend   :5173   nginx（静的配信 + リバースプロキシ）
```

### 停止・削除

```bash
# 停止
docker compose down

# DBデータも含めて完全削除
docker compose down -v
```

---

## ローカル（Docker なし）で起動する

### 前提条件

- Node.js 20+
- PostgreSQL 16

### 手順

```bash
# 1. 依存パッケージのインストール
npm install

# 2. 環境変数を設定
cp .env.example packages/backend/.env
# ANTHROPIC_API_KEY, DATABASE_URL を編集

# 3. DB セットアップ（初回のみ）
cd packages/backend
npx prisma migrate dev
npx ts-node prisma/seed.ts
cd ../..

# 4. 起動（バックエンド + フロントエンド 同時）
npm run dev
```

---

## デモアカウント

初期シードで以下のアカウントが作成されます（パスワード共通: `password123`）。

| ロール | メールアドレス | 遷移先 |
|--------|--------------|--------|
| ADMIN | admin@sakura.co | `/admin` |
| SUPERVISOR | supervisor@sakura.co | `/monitor` |
| OPERATOR | operator1@sakura.co | `/operator` |
| OPERATOR | operator2@sakura.co | `/operator` |
| USER | user1@sakura.co | `/chat` |
| USER | user2@sakura.co | `/chat` |

---

## エージェントの使い方

チャット画面で `/hr` コマンドを使用します：

```
/hr 有給を3日申請したい
/hr 先週火曜日の打刻を修正したい
/hr 有給の残日数を確認したい
```

エージェントが自動でSmartHRと連携して処理します。
対応できない場合はオペレータに転送され、担当者がチャットに参加します。

---

## プロジェクト構成

```
sakura-space/
├── docker-compose.yml
├── .env.example
├── packages/
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── docker-entrypoint.sh
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # DB スキーマ
│   │   │   └── seed.ts             # 初期データ
│   │   └── src/
│   │       ├── agents/
│   │       │   ├── hrAgent.ts      # エージェント本体（アジェンティックループ）
│   │       │   └── tools/
│   │       │       ├── smarthr.ts      # SmartHR ツール定義
│   │       │       └── servicenow.ts   # ServiceNow ツール定義
│   │       ├── mock/
│   │       │   ├── smarthr.ts      # SmartHR モックAPI
│   │       │   └── servicenow.ts   # ServiceNow モックAPI
│   │       ├── middleware/
│   │       │   └── auth.ts         # JWT 認証 + RBAC
│   │       ├── routes/
│   │       │   ├── auth.ts         # ログイン / me
│   │       │   ├── rooms.ts        # チャットルーム管理
│   │       │   └── admin.ts        # ユーザー・権限管理
│   │       ├── socket/
│   │       │   └── index.ts        # Socket.io ハンドラ
│   │       └── services/
│   │           └── permission.ts   # 権限取得サービス
│   └── frontend/
│       ├── Dockerfile
│       ├── nginx.conf
│       └── src/
│           ├── pages/
│           │   ├── Login.tsx
│           │   ├── user/UserChat.tsx
│           │   ├── operator/OperatorChat.tsx
│           │   ├── operator/OperatorMonitor.tsx
│           │   └── admin/AdminConsole.tsx
│           ├── components/
│           │   └── ChatWindow.tsx
│           ├── api/
│           │   ├── client.ts       # Axios インスタンス
│           │   └── socket.ts       # Socket.io クライアント
│           └── stores/
│               └── auth.ts         # Zustand 認証ストア
```
