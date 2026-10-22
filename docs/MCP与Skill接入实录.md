# MCP 与 Skill 接入实录

> **CLAUDE.md 只能让 AI"记住规则"，怎么让 AI 真正"多两只手、多一套流程"？**
>
> 记忆类机制（CLAUDE.md / AGENTS.md）管"知道该怎么做"；
> **MCP** 给 AI 装上"手"——可调用外部工具的能力；
> **Skill** 给 AI 装上"流程"——可复用的结构化工作方法。
> 本文记录本项目真实接入两者的全过程：每个命令、每次验证、每个踩过的坑。

## 1. 定位：六种机制各管什么

| 机制 | 载体 | 管什么 | 何时生效 |
|------|------|--------|----------|
| CLAUDE.md / AGENTS.md | markdown | 记忆：规则、背景、偏好 | 每次会话自动读入 |
| hooks | shell 脚本 | 门禁：机器强制的检查 | git commit 等事件触发 |
| **MCP** | .mcp.json + server 进程 | **手**：AI 可调用的外部工具 | 会话中按需调用 |
| **Skill** | .claude/skills/*/SKILL.md | **流程**：结构化方法论 | 按 description 自动触发 |
| workflows | workflow 脚本 | 多智能体半自动流程 | 用户显式发起 |
| plugin | 插件市场安装 | 预打包的 skills/commands/hooks | 安装后常驻 |

一句话：**MCP 扩能力边界，Skill 扩行为模式；两者都扩"AI 能做什么"，
CLAUDE.md 扩"AI 该记住什么"。**

## 2. MCP 三句话

1. **传输**：stdio 上的 JSON-RPC，一行一条消息（换行分隔，不是 LSP 的 Content-Length 帧）。
2. **握手**：`initialize`（server 报上名号与能力）→ 客户端发
   `notifications/initialized`（无 id 的通知，**server 不回包**）。
3. **干活**：`tools/list` 亮出工具清单，`tools/call` 按名调用；结果统一为
   `{content:[{type:"text",text:...}],isError}`。

resources、prompts、采样等都是可选扩展——
**只实现这三件事的 server 已经是完全可用的 MCP server。**

## 3. 动手接入：本地 demo server（实录）

### 3.1 server 端长什么样

`mcp-server/index.js`（约 170 行，零 npm 依赖）的骨架：

```js
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const msg = JSON.parse(line);           // 一行一条 JSON-RPC
  const reply = handle(msg);              // 按 method 分发
  if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
});
```

三个方法的处理要点：

- `initialize`：回显客户端 `protocolVersion`（规范会演进，不硬编码版本号）
  + `serverInfo` + `capabilities: {tools:{}}`
- `tools/list`：每个工具返回 name / description / inputSchema（JSON Schema）
- `tools/call`：执行工具；工具内部异常包成 `isError: true`，**绝不让 server 崩溃**

本项目提供的三个教学工具（全部只读不写）：

| 工具 | 参数 | 行为 |
|------|------|------|
| `list_features` | `state`（可选过滤） | 列出 feature_list.json 功能项 |
| `get_feature` | `id`（必填，如 F01） | 查单个功能项详情（含 verification） |
| `project_status` | 无 | 状态计数 + git 分支/最近提交 |

设计细节：所有路径用 `path.join(__dirname, '..')` 解析——
**不依赖客户端从哪个 cwd 启动 server**。
为什么零依赖手写而不用官方 SDK？见 docs/DECISIONS.md ADR-006。

### 3.2 客户端配置：.mcp.json

```json
{
  "mcpServers": {
    "harness-demo": {
      "command": "node",
      "args": ["mcp-server/index.js"]
    }
  }
}
```

放在项目根目录 = **项目级配置**：随仓库分发、全员共享。
（与之相对，`~/.claude.json` 里的用户级配置只属于你个人。）

### 3.3 三层验证

| 层 | 命令 | 证明什么 |
|----|------|----------|
| 协议层 | `node mcp-server/test.js` | spawn 真实 server 走完握手+调用（不依赖 claude CLI） |
| 配置层 | `claude mcp list` / `claude mcp get harness-demo` | Claude Code 能发现并连接 server |
| 会话层 | 会话内 `/mcp` + 让 AI 实调工具 | 端到端：AI 真的在用 |

### 3.4 本次接入记录（2026-10-22）

```
$ node mcp-server/test.js
  ✓ initialize 握手返回 serverInfo.name=harness-demo
  ✓ tools/list 返回恰有 3 个工具（get_feature/list_features/project_status）
  ✓ tools/call list_features 返回功能清单且包含 F01
测试结果: 3 通过, 0 失败

$ claude mcp get harness-demo
  Scope: Project config (shared via .mcp.json)
  Status: ⏸ Pending approval (run `claude` to approve)
```

三个如实的发现：

1. **相对路径可用**：`args` 里的 `mcp-server/index.js` 被正确解析，无需绝对路径
2. **项目级配置要"批准"**：`.mcp.json` 是共享配置，Claude Code 首次使用会在会话里
   要求确认信任（防止仓库偷渡恶意 server）——这是安全特性，不是故障
3. **握手测试自带最小客户端**：`test.js` 不依赖 claude CLI，clone 下来就能验证

## 4. 接入真实第三方 MCP server

> ⚠️ **本节示例只放文档里，不要整段复制进 `.mcp.json`**——缺少访问令牌时
> server 启动失败，每次开新会话都会报错刷屏。需要哪个再单独加哪个。

### 4.1 前置条件一览

| server | 传输 | 前置条件 |
|--------|------|----------|
| GitHub | HTTP 远程 | GitHub 访问令牌（PAT） |
| GitHub | npx 本地 | 同上 + Node |
| Context7 | npx 本地 | 基础使用免令牌；进阶需访问令牌（环境变量名以官方 README 为准） |
| filesystem | npx 本地 | 无——零门槛体验第三方 server |

### 4.2 GitHub MCP server

HTTP 远程形式（官方托管端点）：

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

npx 本地 stdio 形式：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<你的访问令牌>" }
    }
  }
}
```

### 4.3 Context7（文档检索，基础使用免令牌）

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

### 4.4 filesystem（零门槛第三方示例）

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    }
  }
}
```

### 4.5 核对声明（诚实记录）

⚠️ **2026-10-22：本机网络受限，上述包名/URL 未能在线对照官方 README 核对**，
写作依据为既有公开文档记忆。第三方包名、URL、环境变量名都会随官方演进——
**接入前请以各自的官方 README 为准**，核对后把日期改到这里。
