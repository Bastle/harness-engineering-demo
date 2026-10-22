# 项目进度

## 当前状态
- 分支: feature/mcp-skill（接入 MCP 与 Skill）
- 测试状态: make test 6 通过 0 失败（含 MCP 握手自测）；make check 全绿（setup + test + lint）
- Lint: 6 通过 0 失败（含 Skill frontmatter 检查）

## 已完成
- [x] 仓库初始化
- [x] AGENTS.md 创建
- [x] feature_list.json 创建
- [x] PROGRESS.md 创建
- [x] F04 零依赖 demo MCP server（mcp-server/index.js + 握手自测 test.js）
- [x] F05 .mcp.json 项目级 MCP 配置（claude mcp list 冒烟通过）
- [x] F06 实用 Skill project-status（make status 取证汇总）
- [x] F07 实用 Skill new-feature（NEW_FEATURE 模板引导）
- [x] F08 主教学文档《MCP与Skill接入实录》（334 行，九节）
- [x] F09 挂接更新（README 学习路径/目录树、CLAUDE.md、ADR-006、三道防线、AGENTS.md）
- [x] F10 MCP 握手测试与 Skill 结构检查纳入 init.sh（make test/lint 统一验证入口）

## 进行中
- 无

## 已知问题
- 无

## 下一步
1. 端到端人工验收：会话内批准 harness-demo 并实调工具；触发两个 Skill
