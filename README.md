# Harness Demo — AI 辅助开发工作流学习教材

> 一个最小化的 harness 工程实践项目，教你如何用结构化的方式让 AI 助手高效地帮你开发软件。

## 什么是 Harness？

在 AI 辅助开发中，**harness（管理框架）** 是一套规则、文件和流程的组合，用来：

1. **约束** AI 的行为，让它不会"跑偏"（比如同时改三个功能、删掉不该删的文件）
2. **追踪** 项目进度，每次中断后能无缝继续
3. **验证** 每一步的产出，确保代码改了就是改了、跑了就是过了

简单说：harness = 给 AI 画跑道。

## 目录结构

```
harness-demo/
├── README.md              # 你正在读的文件——面向人类的项目说明
├── CLAUDE.md              # Claude Code 专用指令（AI 读的）
├── AGENTS.md              # AI 助手的工作规则（所有 AI 工具通用）
├── Makefile               # 统一任务入口（make test、make check 等）
├── PROGRESS.md            # 项目进度追踪
├── feature_list.json      # 功能清单（结构化任务追踪）
├── init.sh                # 环境检查和测试脚本
├── docs/
│   └── DECISIONS.md       # 架构决策日志（为什么这样设计）
├── hooks/
│   └── pre-commit         # Git 提交前自动验证钩子
└── templates/
    └── NEW_FEATURE.md     # 新功能开工模板
```

## 快速开始

```bash
# 1. 检查环境
make setup

# 2. 运行测试
make test

# 3. 完整验证（环境 + 测试）
make check

# 4. 安装 Git 钩子（可选）
cp hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 学习路径

建议按以下顺序阅读和实践：

| 步骤 | 文件 | 学到什么 |
|------|------|----------|
| 1 | README.md | 项目全貌 |
| 2 | CLAUDE.md | AI 如何读取项目上下文 |
| 3 | AGENTS.md | 如何用规则约束 AI 行为 |
| 4 | feature_list.json | 如何用结构化数据追踪任务 |
| 5 | PROGRESS.md | 如何维护人类可读的进度 |
| 6 | Makefile | 如何用声明式命令管理项目 |
| 7 | init.sh | 如何编写验证脚本 |
| 8 | docs/DECISIONS.md | 如何记录设计决策 |
| 9 | hooks/pre-commit | 如何用守护机制保障质量 |

## 核心原则

1. **WIP=1**：同一时间只做一件事，完成验证后才开始下一个
2. **验证驱动**：每个功能都有对应的验证命令，通过了才算完成
3. **可追溯**：所有变更都有 commit message，所有决策都有记录
4. **最小化**：只加必要的东西，不搞过度工程

## 许可

这是一个学习项目，随意使用。
