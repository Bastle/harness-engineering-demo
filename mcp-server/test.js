#!/usr/bin/env node
// mcp-server/test.js — MCP 握手自测（端到端验证 server 能被调用）
//
// 为什么需要这个测试？
// MCP server 是个"被动进程"：没人连它它就闲着，
// 代码写错了它也不会自己报错。
// 这个脚本扮演一次真正的 MCP 客户端：spawn 真实 server 进程，
// 走完 initialize → notifications/initialized → tools/list → tools/call
// 全流程——用真实行为证明"能被调用"，而不是"代码看起来对"。
// 不依赖 claude CLI：读者没装 Claude Code 也能验证。
//
// 运行：node mcp-server/test.js
// 全部通过 exit 0；任一失败 exit 1（feature_list 的 verification 命令就是它）

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const SERVER_PATH = path.join(__dirname, 'index.js');
const TIMEOUT_MS = 5000;

let passed = 0;
let failed = 0;
let done = false;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function finish(child, code) {
  done = true;
  try { child.kill(); } catch (_) { /* 已退出 */ }
  console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
  process.exit(code);
}

function main() {
  // spawn 真实 server 子进程——测的是可运行物，不是源码文本
  const child = spawn(process.execPath, [SERVER_PATH], { stdio: ['pipe', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: child.stdout });

  const pending = new Map(); // JSON-RPC id -> resolve
  const raw = []; // 所有应答行（含无主 id 的错误应答），供敌意输入断言用
  let nextId = 1;

  // 全局超时：server 不回包时不许测试挂死
  const timer = setTimeout(() => {
    check('测试在时限内完成', false, `超时（${TIMEOUT_MS} 毫秒内未完成）`);
    finish(child, 1);
  }, TIMEOUT_MS);

  // server 早退（比如 index.js 不存在）→ 立即失败，报错比超时清楚
  child.on('exit', (code) => {
    if (done) return;
    clearTimeout(timer);
    check('server 保持存活直到测试结束', false, `进程提前退出（exit=${code}），握手未完成`);
    finish(child, 1);
  });

  // 一行一条 JSON-RPC 应答，按 id 送回对应的等待者
  rl.on('line', (line) => {
    raw.push(line);
    let msg;
    try { msg = JSON.parse(line); } catch (_) { return; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  (async () => {
    // 1) 握手：initialize —— server 应报上 serverInfo.name
    const init = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    check(
      'initialize 握手返回 serverInfo.name=harness-demo',
      !!(init.result && init.result.serverInfo && init.result.serverInfo.name === 'harness-demo'),
      JSON.stringify(init).slice(0, 100)
    );

    // 2) 握手完成通知（无 id）——server 不应回包，这一步常被漏掉
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    // 3) tools/list —— 恰好亮出三个教学工具
    const list = await request('tools/list', {});
    const names = (((list.result || {}).tools) || []).map((t) => t.name).sort().join(',');
    check(
      'tools/list 返回恰有 3 个工具（get_feature/list_features/project_status）',
      names === 'get_feature,list_features,project_status',
      `实际: ${names || '(空)'}`
    );

    // 4) tools/call —— 真正干活：列出功能清单，应包含 F01
    const call = await request('tools/call', { name: 'list_features', arguments: {} });
    const result = call.result || {};
    const text = ((result.content || [])[0] || {}).text || '';
    check(
      'tools/call list_features 返回功能清单且包含 F01',
      result.isError === false && text.includes('F01'),
      text.slice(0, 100)
    );

    // 5) 敌意输入 —— 合法 JSON 但不是消息对象（null/数组/裸标量）
    //    文档承诺"绝不让 server 崩溃"，这一步就是该承诺的守卫
    for (const junk of ['null', '[]', '"hello"', '42']) {
      child.stdin.write(junk + '\n');
    }
    const probe = await request('tools/list', {});
    check(
      '垃圾输入后 server 不崩且仍正常应答',
      !!(probe.result && Array.isArray(probe.result.tools)),
      JSON.stringify(probe).slice(0, 100)
    );
    check(
      '垃圾输入收到 -32600 Invalid Request 应答',
      raw.some((l) => l.includes('-32600')),
      `已收应答行数: ${raw.length}`
    );

    clearTimeout(timer);
    finish(child, failed === 0 ? 0 : 1);
  })().catch((err) => {
    clearTimeout(timer);
    check('测试脚本正常运行', false, `异常: ${err.message}`);
    finish(child, 1);
  });
}

main();
