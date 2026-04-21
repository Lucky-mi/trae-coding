# WordGauge V1 升级计划：记忆存储与自适应引擎

在完成 P0（核心测评演示闭环）后，V1 的核心目标是**让系统具备“真实应用”的能力**：引入用户系统、数据库持久化（记忆功能）、更聪明的出题算法（自适应流式出题）以及更具迷惑性的干扰项。

后续的“个性化分析”与“复测调度（艾宾浩斯）”将在 V2/V3 中基于 V1 沉淀的数据进行开发。

---

## 1. 核心升级目标

1.  **用户与记忆存储（优先）**：
    *   引入注册/登录机制（JWT 鉴权）。
    *   将用户的每次测评（Session）、每道题的作答（Answer）持久化到数据库。
    *   记录每个用户的“错题本”（便于后续 V2 的个性化复测）。
2.  **自适应出题引擎（CAT, Computerized Adaptive Testing）**：
    *   **从“静态发卷”改为“流式发题”**：目前是开始时把 12 题一次性下发；V1 将改为每次请求给 1 题，用户提交答案后，后端根据对错计算下一题的难度（Level）。
    *   *策略*：答对，下一题从更高级别（Level + 1）抽；答错，从更低级别（Level - 1）抽。
3.  **强干扰项生成算法**：
    *   引入 **编辑距离（Levenshtein distance）** 算法。
    *   在生成选项时，优先从词库中寻找“长得像”（如 `booth` 与 `boot`, `smooth`）或者“词性相同”的单词释义作为干扰项，杜绝完全无关的“瞎凑”选项。

---

## 2. 技术方案与选型

为保持轻量且快速落地，V1 在 Node.js 后端架构上做以下加码：

*   **数据库**：`SQLite`（使用 `better-sqlite3`，轻量且无需额外部署独立数据库服务，单文件落盘，极其适合当前体量，未来需要时可平滑迁移至 PostgreSQL）。
*   **鉴权方案**：`jsonwebtoken` (JWT) + `bcryptjs` (密码哈希)。
*   **ORM / Query Builder**：手写原生 SQL 或使用轻量级工具（为追求极致控制，本次采用原生 SQL）。

---

## 3. 数据库表结构设计 (SQLite)

V1 阶段需要建立以下核心表：

1.  **`users`**：用户表
    *   `id` (PK, UUID)
    *   `username` (唯一)
    *   `password_hash`
    *   `created_at`
2.  **`words`**：词库表（从 xlsx 导入的持久化结果）
    *   `id` (PK, UUID)
    *   `word` (单词本体)
    *   `meaning_zh` (释义)
    *   `stage` (小学/初中/高中)
    *   `level` (难度等级)
    *   `pos` (词性)
3.  **`assessment_sessions`**：测评场次表
    *   `id` (PK, UUID)
    *   `user_id` (FK -> users.id)
    *   `stage` (所选学段)
    *   `status` (ongoing / completed)
    *   `created_at`, `ended_at`
4.  **`assessment_answers`**：答题流水表（记忆存储的核心）
    *   `id` (PK, UUID)
    *   `session_id` (FK -> sessions.id)
    *   `word_id` (FK -> words.id)
    *   `is_correct` (Boolean)
    *   `user_choice_index` (用户选了第几项)
    *   `time_spent_ms` (答题耗时)
    *   `created_at`

---

## 4. API 接口变更 (RESTful)

### 4.1 新增：用户模块
*   `POST /api/auth/register` (注册)
*   `POST /api/auth/login` (登录，返回 JWT)
*   `GET /api/auth/me` (获取当前用户信息)

### 4.2 重构：自适应测评流 (需携带 `Authorization: Bearer <token>`)
*   `POST /api/assessments/start`
    *   **入参**：`{ stage: "初中" }`
    *   **出参**：`{ session_id, first_question }`（只返回第一题，不再返回所有题）。
*   `POST /api/assessments/:sessionId/answer`
    *   **入参**：`{ question_id, choice_index, time_spent_ms }`
    *   **出参**：`{ is_correct, next_question, is_done }`（后端根据这道题的对错，实时算计下一题的难度并下发）。
*   `GET /api/assessments/:sessionId/result`
    *   **出参**：从 DB 中聚合当前 session 的数据，返回雷达图/柱状图所需的数据结构。

---

## 5. 开发实施步骤 (Milestones)

*   **Step 1：数据库底座与词库迁移**
    *   引入 `better-sqlite3`。
    *   写脚本：在后端启动时，如果 `words` 表为空，自动读取根目录 3 个 xlsx 并写入数据库。
*   **Step 2：用户与鉴权体系**
    *   实现注册、登录 API 与 JWT 校验中间件。
    *   前端增加 Login / Register 页面与路由拦截。
*   **Step 3：算法升级（编辑距离与流式出题）**
    *   实现基于 Levenshtein 的 `pickDistractors` 逻辑。
    *   重写 `/start` 和 `/answer` 接口，接入 SQLite 存储 session 和答题流水，并实现“答对升难度，答错降难度”的 CAT 逻辑。
*   **Step 4：前端联调与改造**
    *   将 Zustand 的 `useSession` 彻底改为云端 API 驱动。
    *   答题页逻辑从“遍历本地数组”改为“每次选完拉取接口并展示 loading，直至接口返回 done: true”。

---

本计划将“数据持久化”和“出题科学性”作为最高优先级，完成后系统将具备真正的商用雏形。确认后，我们将从 Step 1 (SQLite 接入与鉴权) 开始编码。