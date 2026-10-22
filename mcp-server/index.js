#!/usr/bin/env node
// mcp-server/index.js — 零依赖 demo MCP server
//
// 为什么需要这个文件？
// MCP（Model Context Protocol）server 到底长什么样？
// 去掉所有框架之后只剩一件事：
//   **在 stdin 上读 JSON-RPC 消息，在 stdout 上写 JSON-RPC 应答，一行一条。**
// 这就是 MCP stdio 传输的全部秘密（注意：换行分隔，
// 不是 LSP 的 Content-Length 帧）。
//
// 一个 server 只需要伺候三个方法：
//   initialize  — 握手，报上名号和能力
//   tools/list  — 亮出工具清单
//   tools/call  — 干活
// 外加 notifications/initialized：客户端发来的握手完成通知，不回包。
//
// 零 npm 依赖：`node mcp-server/index.js` 就能跑，
// 协议的每一行都摊在你面前——这正是它作为教材的价值。
// 设计决策见 docs/DECISIONS.md ADR-006，接入过程见 docs/MCP与Skill接入实录.md。

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const SERVER_INFO = { name: 'harness-demo', version: '1.0.0' };
// 项目根目录：路径一律相对 __dirname 解析，不依赖客户端从哪个 cwd 启动我们
const PROJECT_ROOT = path.join(__dirname, '..');

// ---------- 工具实现（只读不写，不会弄脏仓库） ----------

function loadFeatures() {
  const raw = fs.readFileSync(path.join(PROJECT_ROOT, 'feature_list.json'), 'utf8');
  return JSON.parse(raw).features;
}

function listFeatures(args) {
  const features = loadFeatures();
  const state = args && args.state;
  const filtered = state ? features.filter((f) => f.state === state) : features;
  const rows = filtered.map((f) => ({ id: f.id, behavior: f.behavior, state: f.state }));
  return { text: JSON.stringify(rows, null, 2), isError: false };
}

function getFeature(args) {
  const id = args && args.id;
  const feature = loadFeatures().find((f) => f.id === id);
  if (!feature) {
    return { text: `找不到功能项: ${id}`, isError: true };
  }
  return { text: JSON.stringify(feature, null, 2), isError: false };
}

function projectStatus() {
  const features = loadFeatures();
  const counts = {};
  for (const f of features) counts[f.state] = (counts[f.state] || 0) + 1;
  const summary = `功能项 ${features.length} 个：passing ${counts.passing || 0} / ` +
    `in_progress ${counts.in_progress || 0} / not_started ${counts.not_started || 0}`;
  let git = 'git 信息不可用';
  try {
    const branch = execSync('git branch --show-current', { cwd: PROJECT_ROOT }).toString().trim();
    const last = execSync('git log -1 --oneline', { cwd: PROJECT_ROOT }).toString().trim();
    git = `分支 ${branch}，最近提交：${last}`;
  } catch (_) {
    /* 非 git 环境不致命，继续返回功能项统计 */
  }
  return { text: `${summary}\n${git}`, isError: false };
}

// ---------- 工具清单（tools/list 的数据源） ----------

const TOOLS = [
  {
    name: 'list_features',
    description: '列出 feature_list.json 中的功能项（可按 state 过滤）',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          enum: ['not_started', 'in_progress', 'passing'],
          description: '只看该状态的功能项',
        },
      },
    },
  },
  {
    name: 'get_feature',
    description: '按 id 查询单个功能项详情（含 verification 命令）',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '功能项 id，例如 F01' } },
      required: ['id'],
    },
  },
  {
    name: 'project_status',
    description: '汇总项目状态：功能项状态计数 + git 分支与最近提交',
    inputSchema: { type: 'object', properties: {} },
  },
];

function callTool(name, args) {
  // 工具内部出错只标记 isError，绝不让整个 server 崩掉
  try {
    if (name === 'list_features') return listFeatures(args);
    if (name === 'get_feature') return getFeature(args);
    if (name === 'project_status') return projectStatus();
    return { text: `未知工具: ${name}`, isError: true };
  } catch (err) {
    return { text: `工具执行出错: ${err.message}`, isError: true };
  }
}

// ---------- JSON-RPC 分发 ----------

function ok(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function fail(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function handle(msg) {
  const { id, method, params } = msg;

  // 通知类消息（无 id）不回包——notifications/initialized 就是这一类
  if (id === undefined) return null;

  if (method === 'initialize') {
    return ok(id, {
      // 回显客户端的协议版本：规范会演进，不硬编码断言
      protocolVersion: (params && params.protocolVersion) || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === 'tools/list') {
    return ok(id, { tools: TOOLS });
  }
  if (method === 'tools/call') {
    const out = callTool(params && params.name, params && params.arguments);
    return ok(id, { content: [{ type: 'text', text: out.text }], isError: out.isError });
  }
  // 其他 method（ping、resources/* 等）本 demo 不实现
  return fail(id, -32601, `Method not found: ${method}`);
}

// ---------- 主循环：一行一条消息 ----------

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (_) {
    process.stdout.write(JSON.stringify(fail(null, -32700, 'Parse error')) + '\n');
    return;
  }
  const reply = handle(msg);
  // 有应答才写 stdout；写完就等下一行
  if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
});
