# WordGauge 多人联机系统设计方案 (Multiplayer V1)

为了让单词测评具备极强的**传播性**和**用户黏性**，单机刷题远远不够。我们需要将系统从“单机 HTTP 请求”升级为“实时双向通信 (WebSocket)”，打造一个刺激的**同台竞技**环境。

---

## 1. 核心玩法发散 (Gameplay Modes)

我为你构思了三种最容易引爆传播的联机模式：

### 模式 A：1v1 巅峰排位赛 (Ranked Match) - 推荐首选
*   **玩法**：用户点击“匹配”，系统在 5 秒内为其匹配水平相近（基于 V1 计算出的胜率/正确率）的对手。
*   **机制**：双方**同时回答同一套题**（共 20 题）。
*   **刺激点**：
    *   **双进度条竞速**：页面上方同时显示你和对手的进度条（用 GSAP 做追赶动画）。
    *   **Combo 连击系统**：连续答对触发 Combo，如果你的答题速度比对手快且正确，给对手施加“Debuff”（比如：对手屏幕震动、选项顺序打乱）。
    *   **排位积分 (Elo Rating)**：赢了加分，输了掉分，积分决定你的“段位”（青铜学渣 -> 最强王者）。

### 模式 B：好友开黑房 (Custom Room / Kahoot Style)
*   **玩法**：你创建一个房间，生成一个 6 位房间号（如 `AX8F92`），发给微信群或同学。大家输入房间号进入等待大厅。
*   **机制**：房主点击“开始”，所有人进入同步答题状态。
*   **计分规则**：不仅看对错，还看**速度**。答对且越快得分越高。最后生成一张包含所有人排名的炫酷分享海报。

### 模式 C：全服词汇量天梯榜 (Global Leaderboard)
*   **玩法**：异步联机。基于大家在“单人自适应测评”中打出的最终成绩（预估词汇量/正确率）进行全服排名。每天晚上 12 点结算发放“词霸”徽章。

---

## 2. 技术架构怎么实现？(Technical Implementation)

目前我们的系统是 `React + FastAPI(替换成了 Node.js/Express) + SQLite`，这是一个标准的无状态 HTTP 架构。要实现联机，必须引入 **WebSocket**。

### 2.1 引入 `Socket.io` (实时通信底座)
*   **后端**：在 Express 基础上挂载 `socket.io` 服务器。
*   **前端**：引入 `socket.io-client`。当用户进入“对战大厅”时建立长连接。

### 2.2 状态机管理 (In-Memory Room Manager)
因为是实时对战，房间状态不能频繁读写 SQLite 数据库，需要存在 Node.js 的内存中（或 Redis，但目前 Node 内存 `Map` 就足够支撑几千人并发）。
*   **匹配池 (`MatchmakingQueue`)**：一个数组，存放正在等待 1v1 的玩家。每秒轮询一次，把两个玩家组合成一个 Room。
*   **房间字典 (`Rooms: Map<string, RoomState>`)**：
    ```typescript
    type RoomState = {
      roomId: string;
      players: { [userId: string]: { score: number, currentQuestionIndex: number, combo: number } };
      questions: ApiQuestion[]; // 提前生成好的同一套题
      status: 'waiting' | 'playing' | 'finished';
    }
    ```

### 2.3 核心通信流程 (1v1 PK 为例)
1.  **握手与匹配**：前端 `socket.emit('find_match', { stage: '初中' })`。
2.  **匹配成功**：后端找到对手，生成同一套题，发给两人 `socket.emit('match_found', { opponent: '张三', questions: [...] })`。
3.  **倒计时开始**：前端显示 3..2..1 开始。
4.  **同步进度**：你选了一个答案，前端不发 HTTP，而是 `socket.emit('submit_answer', { q_index: 0, is_correct: true })`。
5.  **广播状态**：后端收到后，更新房间积分，并向**两人同时广播** `socket.emit('score_update', { you: 100, opponent: 120 })`。
6.  **结算**：某一方答完最后一题，后端计算胜负，将结果落入 SQLite `battles` 表，并派发 `socket.emit('game_over', { winner: '张三' })`。

### 2.4 SQLite 数据库表扩展
为了持久化战绩，我们需要加一张表：
*   **`battles` (对战记录表)**
    *   `id` (PK)
    *   `player1_id`
    *   `player2_id`
    *   `winner_id`
    *   `score1`
    *   `score2`
    *   `created_at`
*   并在 `users` 表里增加 `elo_rating` (排位分，默认 1000) 字段。

---

## 3. 落地实施路线 (Roadmap)

如果决定开搞，我们可以按以下步骤：

*   **Step 1：基建与 DB**
    *   在后端安装 `socket.io`，挂载到现有的 Express server 上。
    *   在 SQLite 增加 `battles` 表和用户的 `elo_rating` 字段。
*   **Step 2：匹配大厅与 Socket 联通**
    *   前端增加一个 `/battle` 页面，点击“寻找对手”。
    *   后端实现 `Matchmaker` 逻辑，成功后让两人进入同一个 WebSocket Room。
*   **Step 3：同步答题 UI 与动效**
    *   复用一部分 `QuizPage`，但顶部增加两个血条/进度条。
    *   接入 GSAP 动画，当收到对手答对的 Socket 消息时，对手血条猛涨，给你压迫感。
*   **Step 4：结算与排位分**
    *   游戏结束，展示“Victory”或“Defeat”页面。
    *   根据 Elo 算法计算加扣分，写入数据库。

---

💡 **你觉得如何？**
为了最快见到效果并且最好玩，我强烈建议我们先实现 **“模式 A：1v1 巅峰排位赛”**（带双进度条竞速）。

如果你觉得这个思路对了，给我个指令，我马上开始给你的项目装 `socket.io` 并把后端的匹配逻辑搭起来！