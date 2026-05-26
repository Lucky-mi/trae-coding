# WordGauge 免费公网部署指南

我们的项目是一个典型的前后端分离架构：
- **前端 (apps/web)**: React + Vite 构建的静态单页应用 (SPA)。
- **后端 (services/api-node)**: Node.js (Express) 提供的 REST API，核心痛点是使用了 **SQLite (`data.db`)** 本地单文件数据库。

⚠️ **核心注意点**：绝大多数免费的 Serverless 平台（如 Vercel, Netlify 函数）都是“无状态”的，每次请求完就会销毁环境，这意味着你存在 SQLite 里的数据（用户、成绩）会丢失！因此后端必须部署在**支持持久化磁盘（Persistent Volume/Disk）**或者**容器/虚拟机**的免费平台上。

这里为你推荐一套 **100% 免费** 且国内访问较友好的黄金部署组合：

---

## 方案 1（最推荐）：前端 Vercel + 后端 Render

### 步骤 1：部署前端到 Vercel (全球最强免费前端托管)
1. 将本地代码提交到你的 GitHub 仓库。
2. 注册并登录 [Vercel](https://vercel.com/)。
3. 点击 **Add New... -> Project**，导入你的 GitHub 仓库。
4. **配置构建参数**（非常重要）：
   - Framework Preset: 选择 `Vite`
   - Root Directory: 输入 `apps/web`
   - Build Command: 保持默认 `npm run build` 或 `yarn build`
   - Output Directory: 保持默认 `dist`
5. 点击 **Deploy**，几十秒后你就能获得一个免费的公网 HTTPS 域名（例如 `wordgauge.vercel.app`）。

### 步骤 2：部署后端到 Render (支持 SQLite 持久化)
[Render.com](https://render.com/) 提供了免费的 Web Service 额度，并且允许你挂载一块免费的持久化磁盘（Disk），这对于 SQLite 来说是完美的！
1. 登录 Render，点击 **New -> Web Service**，绑定你的 GitHub 仓库。
2. **配置服务参数**：
   - Name: 随便起，比如 `wordgauge-api`
   - Root Directory: 输入 `services/api-node`
   - Environment: 选择 `Node`
   - Build Command: 输入 `npm install`
   - Start Command: 输入 `node src/main.js`
   - Instance Type: 选择 **Free** 免费实例。
3. **配置 SQLite 持久化磁盘 (关键)**：
   - 在高级设置 (Advanced) 里找到 **Disks**。
   - Name: `sqlite-data`
   - Mount Path: `/var/data`
   - Size: `1 GB` (免费)
4. **修改代码适配挂载路径**：
   - 在部署前，你需要把 `src/main.js` 里的 `const dbPath = path.join(projectRoot, 'data.db')` 改为：
     ```javascript
     const dbPath = process.env.DB_PATH || path.join(projectRoot, 'data.db')
     ```
   - 然后在 Render 的环境变量 (Environment Variables) 中添加：
     - Key: `DB_PATH`
     - Value: `/var/data/data.db`
5. 点击 **Create Web Service**。部署成功后，你会得到一个后端的公网地址（例如 `https://wordgauge-api.onrender.com`）。

### 步骤 3：前后端联调
1. 回到**前端代码**，将 `apps/web/src/api/client.ts` 里的 `API_BASE` 改为你在 Render 拿到的公网地址：
   ```typescript
   const API_BASE = import.meta.env.VITE_API_BASE || 'https://wordgauge-api.onrender.com'
   ```
2. 回到**后端代码**，在 `src/main.js` 中将你的 Vercel 域名加入 CORS 白名单：
   ```javascript
   app.use(cors({ origin: ['https://wordgauge.vercel.app', 'http://localhost:5173'], credentials: true }))
   ```
3. 把这些改动提交 (git push) 到 GitHub，Vercel 和 Render 都会**自动触发重新部署**。

大功告成！现在你可以把 Vercel 的域名发给任何朋友，他们在手机或电脑上都能随时注册测单词了。

---

## 备选后端方案
如果你觉得 Render 免费版有一段时间不访问会休眠（冷启动大概需要 30-50 秒），你可以考虑以下平台：

1. **Zeabur** (国人团队，网络友好)：
   - 每月有 5 刀的免费额度，部署 Node.js 和挂载持久卷非常简单。
   - 国内直连速度极快，体验极佳。

2. **Fly.io**：
   - 提供 3 个免费虚拟机（256MB RAM），且支持挂载 1GB 的持久卷（Volumes），非常适合跑 SQLite。
   - 唯一的门槛是需要绑定信用卡（不会扣费，仅用于防滥用）。

## 小结建议
先用 **Vercel + Render** 这套零成本、免绑卡的方案把整个架子跑通。只要跟着上面三步走，不到 10 分钟你的 WordGauge 就能向全世界公开了！
