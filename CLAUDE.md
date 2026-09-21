# CLAUDE.md — Claude Code 项目上下文

> **为什么需要这个文件？**
> Claude Code 启动时会自动读取项目根目录的 CLAUDE.md，把它当作"项目记忆"。
> 这意味着你不需要每次都重复告诉 Claude "这个项目是干嘛的、文件在哪、规则是什么"。
> CLAUDE.md 是 Claude 的"入职手册"。

## 项目概述

这是一个 AI 辅助开发工作流的学习教材项目。目标是演示如何用结构化的 harness 框架管理 AI 开发过程。

## 关键文件

| 文件 | 用途 | 谁读 |
|------|------|------|
| `CLAUDE.md` | Claude Code 项目上下文 | Claude |
| `AGENTS.md` | AI 助手工作规则 | 所有 AI 工具 |
| `PROGRESS.md` | 项目进度追踪 | 人和 AI |
| `feature_list.json` | 功能清单 | 人和 AI |
| `Makefile` | 任务入口 | 人和 AI |
| `docs/DECISIONS.md` | 设计决策记录 | 人 |

## 工作规则

在本项目中工作时，请遵守以下规则：

1. **一次只做一个功能**：读 `feature_list.json`，找到 `state` 为 `not_started` 且无依赖未完成的任务
2. **修改前先确认**：读相关文件，理解影响范围，再动手
3. **验证后才标记完成**：运行功能对应的 `verification` 命令，确认通过后才改 `state`
4. **保持进度更新**：每次完成任务后更新 `PROGRESS.md`
5. **不要碰其他子项目**：仓库可能包含其他子目录，只操作当前任务相关的内容

## 工作流

本项目支持半自动开发工作流（`workflows/dev-semi.js`）：

```
用户输入需求 → AI 拆解任务 → 人工审核 → 逐个执行+验收 → 汇总报告
```

触发方式：
```
用 dev-semi workflow 实现 xxx 功能
```

流程中的暂停点：
1. 拆解后 → 你可以修改任务计划
2. 每个任务执行后 → 你可以验收代码、要求修改或跳过

## 常用命令

```bash
make setup   # 检查环境
make test    # 运行测试
make check   # 完整验证
make lint    # 代码风格检查
make status  # 查看项目状态
```

## 会话开始时

1. 读 `PROGRESS.md` 了解当前状态
2. 读 `feature_list.json` 了解任务列表
3. 找到可以继续的工作
4. 开始前说清楚你要做什么

## 会话结束时

1. 运行 `make check` 确保一切正常
2. 更新 `PROGRESS.md`
3. 提交代码并写清楚 commit message

## CLAUDE.md vs AGENTS.md

你可能会问：为什么有两个"规则文件"？

- **CLAUDE.md** 是 Claude Code 专属的，只有 Claude 会读。放 Claude 特有的配置和偏好。
- **AGENTS.md** 是通用的，所有 AI 工具（Copilot、Cursor、Windsurf 等）都可能读。放跨工具的通用规则。

如果你只用 Claude Code，可以在 CLAUDE.md 里写得更详细；如果要兼容多种 AI 工具，把通用规则放 AGENTS.md。
