# 项目进度

## 当前状态
- 分支: feature/mcp-skill（接入 MCP 与 Skill）
- 测试状态: make test 5 通过 0 失败；MCP 握手自测 3 通过 0 失败
- Lint: make check 全绿

## 已完成
- [x] 仓库初始化
- [x] AGENTS.md 创建
- [x] feature_list.json 创建
- [x] PROGRESS.md 创建
- [x] F04 零依赖 demo MCP server（mcp-server/index.js + 握手自测 test.js）

## 进行中
- 无

## 已知问题
- 无

## 下一步
1. F05 创建 .mcp.json，冒烟验证 claude mcp list
2. F06/F07 编写 project-status 与 new-feature 两个实用 Skill
3. F08 编写《MCP与Skill接入实录》主教学文档
4. F09 挂接更新（README/CLAUDE.md/ADR-006/三道防线/AGENTS.md）
5. F10 把 MCP/Skill 校验纳入 make test/lint
