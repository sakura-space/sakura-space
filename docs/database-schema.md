# データベーススキーマ

データベース: **PostgreSQL**
ORM: **Prisma**

---

## Enum 一覧

### Role（ユーザーロール）
| 値 | 説明 |
|---|---|
| `USER` | 一般ユーザー |
| `OPERATOR` | オペレーター |
| `SUPERVISOR` | スーパーバイザー |
| `ADMIN` | 管理者 |

### ApiType（外部API種別）
| 値 | 説明 |
|---|---|
| `SMARTHR` | SmartHR API |
| `SERVICENOW` | ServiceNow API |

### MessageType（メッセージ種別）
| 値 | 説明 |
|---|---|
| `TEXT` | 通常テキスト |
| `AGENT_TEXT` | エージェントの応答テキスト |
| `AGENT_THINKING` | エージェントの思考過程 |
| `AGENT_TOOL_CALL` | エージェントのツール呼び出し |
| `AGENT_TOOL_RESULT` | エージェントのツール実行結果 |
| `SYSTEM` | システムメッセージ |

### AgentStatus（エージェントセッション状態）
| 値 | 説明 |
|---|---|
| `ACTIVE` | 対応中 |
| `ESCALATED` | エスカレーション済み |
| `RESOLVED` | 解決済み |
| `CLOSED` | クローズ |

---

## テーブル一覧

### User（ユーザー）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | String (cuid) | PK | ユーザーID |
| `email` | String | UNIQUE, NOT NULL | メールアドレス |
| `password` | String | NOT NULL | パスワード（bcryptハッシュ） |
| `name` | String | NOT NULL | 表示名 |
| `role` | Role | NOT NULL, DEFAULT: USER | ロール |
| `createdAt` | DateTime | NOT NULL, DEFAULT: now() | 作成日時 |
| `updatedAt` | DateTime | NOT NULL, auto-update | 更新日時 |

**リレーション**
- `messages` → Message（1対多）
- `memberships` → RoomMember（1対多）

---

### Room（チャットルーム）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | String (cuid) | PK | ルームID |
| `name` | String | NULL可 | ルーム名 |
| `createdAt` | DateTime | NOT NULL, DEFAULT: now() | 作成日時 |
| `updatedAt` | DateTime | NOT NULL, auto-update | 更新日時 |

**リレーション**
- `messages` → Message（1対多）
- `members` → RoomMember（1対多）
- `agentSessions` → AgentSession（1対多）

---

### RoomMember（ルームメンバー）

ユーザーとルームの中間テーブル。

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | String (cuid) | PK | ID |
| `roomId` | String | NOT NULL, FK→Room | ルームID |
| `userId` | String | NOT NULL, FK→User | ユーザーID |
| `joinedAt` | DateTime | NOT NULL, DEFAULT: now() | 参加日時 |

**制約**
- `(roomId, userId)` UNIQUE

**リレーション**
- `room` → Room（Cascade Delete）
- `user` → User（Cascade Delete）

---

### Message（メッセージ）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | String (cuid) | PK | メッセージID |
| `roomId` | String | NOT NULL, FK→Room | ルームID |
| `userId` | String | NULL可, FK→User | 送信者ユーザーID（システム/エージェントはnull） |
| `senderName` | String | NOT NULL | 送信者名 |
| `content` | String | NOT NULL | メッセージ本文 |
| `type` | MessageType | NOT NULL, DEFAULT: TEXT | メッセージ種別 |
| `metadata` | Json | NULL可 | 追加メタデータ |
| `createdAt` | DateTime | NOT NULL, DEFAULT: now() | 送信日時 |

**リレーション**
- `room` → Room（Cascade Delete）
- `user` → User（任意）

---

### AgentSession（エージェントセッション）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | String (cuid) | PK | セッションID |
| `roomId` | String | UNIQUE, NOT NULL, FK→Room | ルームID（1ルーム1セッション） |
| `status` | AgentStatus | NOT NULL, DEFAULT: ACTIVE | セッション状態 |
| `history` | Json | NOT NULL, DEFAULT: [] | 会話履歴（JSON配列） |
| `createdAt` | DateTime | NOT NULL, DEFAULT: now() | 作成日時 |
| `updatedAt` | DateTime | NOT NULL, auto-update | 更新日時 |

**リレーション**
- `room` → Room（Cascade Delete）

---

### ApiPermission（APIパーミッション）

ロールごとの外部API操作権限。

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | String (cuid) | PK | ID |
| `role` | Role | NOT NULL | 対象ロール |
| `api` | ApiType | NOT NULL | 対象API |
| `action` | String | NOT NULL | アクション名 |
| `enabled` | Boolean | NOT NULL, DEFAULT: false | 有効/無効 |
| `label` | String | NOT NULL | 表示名 |
| `createdAt` | DateTime | NOT NULL, DEFAULT: now() | 作成日時 |
| `updatedAt` | DateTime | NOT NULL, auto-update | 更新日時 |

**制約**
- `(role, api, action)` UNIQUE

---

## ER図（概略）

```
User ──────────── RoomMember ──────────── Room
  │                                         │
  └── Message ──────────────────────────────┤
                                            │
                                   AgentSession
                                            │
                                   ApiPermission（Roleによる紐付け）
```
