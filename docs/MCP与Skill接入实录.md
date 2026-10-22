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

## 5. Skill 是什么 + SKILL.md 写法拆解

Skill = 一份**按需加载的说明书**。平时不占上下文；当用户请求匹配
description 里的触发条件时，Claude Code 把整份 SKILL.md 读进上下文并照做。

项目级 skill 放 `.claude/skills/<name>/SKILL.md`（随仓库分发）；
用户级放 `~/.claude/skills/`（个人全局）。本项目用项目级——
它本身就是要演示的教学内容。

### 5.1 frontmatter 字段

| 字段 | 规则 |
|------|------|
| `name` | 字母/数字/连字符；与目录名一致最省心 |
| `description` | **只写触发条件**，不写流程摘要（见下） |

> **为什么 description 只写触发条件？**
> 实测教训：若 description 里写了流程摘要，agent 会照摘要的简版做，
> 跳过正文里的详细步骤。description 是"门铃"，正文才是"说明书"。

### 5.2 正文结构（本项目模板）

1. **概述**——这个 skill 的原则和边界
2. **何时使用**——触发场景（正文版）
3. **操作步骤**——引用命令/文件路径，不内联展开长篇解释
4. **输出格式约定**——汇报长什么样
5. **常见错误**——反模式清单，防止跑偏

目标 500 词以内：skill 是提示词资产，越长越稀释注意力。

### 5.3 反模式

- 叙述体流水账（"首先我们可以考虑……"）
- description 里写流程摘要（见 5.1）
- 把项目文档整篇塞进 skill（应该引用文件路径）
- 多语言样例堆砌，不分主次

## 6. 动手接入两个 Skill（实录）

本项目做了两个，覆盖两大类型：

| skill | 类型 | 干什么 |
|-------|------|--------|
| `project-status` | 工具型 | 跑 `make status` 取证 → 按三列表格汇总状态 |
| `new-feature` | 流程型 | 按 templates/NEW_FEATURE.md 引导登记+开工新功能 |

设计要点（对照源文件）：

- `project-status` 的灵魂是"**不允许凭记忆回答**"——状态类问答最常见的
  失败模式是 AI 复述几轮前的旧状态。skill 强制先跑命令、再读文件、最后汇报
- `new-feature` 把条目 schema、WIP=1、"verification 必须可自动执行"
  等纪律写成可触发的流程

验证方式（自动化部分进 feature_list verification）：

```
$ test -f .claude/skills/project-status/SKILL.md \
    && grep -q '^name: project-status' .claude/skills/project-status/SKILL.md \
    && make status >/dev/null
F06 verification: PASS
```

端到端触发效果属于**人工验收**：新开会话说"汇总一下项目状态"，
观察是否自动触发 project-status 并执行 `make status`。
这是 ADR-004"done = 验证通过"的边界教学点——提示词资产的
"被正确触发"无法完全自动验证，所以拆成
**结构自动检查 + 触发人工验收**两层。

## 7. Plugin：预打包的能力合集

`.claude/settings.json` 里有一行此前没有解释过的配置：

```json
{ "enabledPlugins": { "superpowers@claude-plugins-official": true } }
```

现在补上解释：**plugin = 预打包的 skills + commands + hooks 合集**。
`superpowers` 是官方插件市场里的开发生命周期方法论插件
（brainstorming、TDD、代码审查等一整套 skill）。

分工原则：

- **plugin** 管通用方法论（跨项目复用，社区维护）
- **自写 Skill** 管项目特定流程（如本项目的 feature_list 纪律）
- `/plugin` 命令管理安装与启用

## 8. Harness 全景整合

### 8.1 机制 × 文件 × 协同点

| 机制 | 本项目文件 | 与 MCP/Skill 的协同点 |
|------|------------|----------------------|
| 记忆 | CLAUDE.md / AGENTS.md | 关键文件表登记 .mcp.json、skills，AI 知道去哪找 |
| 清单 | feature_list.json | verification 是所有机制的汇合点 |
| 门禁 | hooks/pre-commit、init.sh | lint 全量 JSON 检查自动覆盖 .mcp.json |
| 编排 | workflows/dev-semi.js | Skill 引导登记，workflow 引导执行 |
| 手 | mcp-server/ + .mcp.json | list_features / get_feature 供 AI 查询清单 |
| 流程 | .claude/skills/ | project-status / new-feature 沉淀项目纪律 |

### 8.2 串场：一个新功能走完全程

1. 用户说"加个功能" → **Skill**（new-feature）自动触发，引导登记
2. 条目写进 **feature_list.json**（含 verification 命令）
3. **workflow**（dev-semi）或直接执行：AI 动手，逐项验证
4. verification 输出 → 填 evidence，state 置 passing
5. **hooks/pre-commit** 门禁：JSON 格式、敏感信息、300 行上限
6. **PROGRESS.md** 更新此刻状态
7. 下次有人问"做到哪了" → **Skill**（project-status）或
   **MCP**（list_features）随时可查——状态是活的

### 8.3 三个协同点

- `.mcp.json` 不需要专门校验：init.sh lint 的全量 JSON 检查
  （`find . -name "*.json"`）自动覆盖它——**好的 harness 是加法越少越好**
- `mcp-server/test.js` 挂进 `make test` 后，MCP 协议正确性
  成为统一验证入口的一部分
- feature_list 的 `verification` 字段是所有机制的汇合点：
  Skill 引导你写好它，workflow 用它取证，MCP 工具把它展示出来

## 9. 实施清单

### 立即可做

- [ ] 运行 `node mcp-server/test.js`，亲手验一次 MCP 握手
- [ ] 运行 `claude mcp get harness-demo`，看懂 Project config 的含义
- [ ] 通读 `mcp-server/index.js`——约 170 行，协议全透明

### 一周内

- [ ] 在会话里批准 harness-demo，实调一次 list_features
- [ ] 按第 4 节加一个真实第三方 server（推荐从 filesystem 起步）
- [ ] 写一个自己的 Skill：把团队最常重复的工作流程固化下来

### 持续执行

- [ ] 每个新工具接入都配 verification（ADR-004 口径）
- [ ] 第三方 server 的包名/URL 定期对照官方 README 核对并更新 4.5 的日期
- [ ] Skill 定期瘦身：删除不再触发的、合并重复的

---

*本文是接入过程的实录，不是终点。feature_list.json 的 F04–F10
是这次接入的任务清单，evidence 字段里留着每一步的验证输出。*
