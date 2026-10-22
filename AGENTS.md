# AGENTS.md

## 项目概览
个人 Git 项目集合仓库，包含多个子项目。每个子项目有独立的代码和需求。

## 快速开始
- 查看项目结构：`ls -la`
- 查看 git 状态：`git status`
- 运行测试：`make test`（如有）
- 完整验证：`make check`（如有）

## 硬约束（不可违反）
1. 不要直接修改 .git 目录
2. 每次修改前先确认影响范围
3. 不要删除其他子项目的内容
4. 敏感信息（API key、密码）绝不提交到 git
5. 代码修改必须有对应注释或 commit message

## 工作规则
- 每次只做一个功能点或修复一个问题
- 完成后必须通过验证才能开始下一个
- 不要在做功能 A 时"顺便"重构功能 B
- 每次会话结束前更新 PROGRESS.md

## 会话流程
### 开始时
1. 读 PROGRESS.md 了解当前状态
2. 读 feature_list.json 了解任务列表
3. 从"下一步"部分继续工作

### 结束时
1. 更新 PROGRESS.md
2. 提交已完成的工作（git commit）
3. 确保无临时文件残留

## 专题文档
- 功能清单说明（见 feature_list.json 内部注释）
- MCP 与 Skill 接入实录（docs/MCP与Skill接入实录.md）
- 质量保证 / 范围控制 / 可维护性（docs/AI开发的三道防线.md）
