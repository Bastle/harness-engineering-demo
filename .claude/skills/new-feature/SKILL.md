---
name: new-feature
description: 当用户要求新增功能、登记任务、开工新功能，或要往 feature_list.json 添加功能条目时使用
---

# 新功能开工引导

## 概述

按本项目的纪律登记并开工一个新功能：先写清"做什么、怎么算做完"，
再动手。核心是 `templates/NEW_FEATURE.md` 的三段 checklist 和
feature_list.json 的条目格式。

## 何时使用

用户说"加一个功能""登记一个任务""开始做 xxx 功能"时。

## 操作步骤

1. **登记条目**：向 `feature_list.json` 的 `features` 数组追加：

   ```json
   {
     "id": "F<下一个序号>",
     "behavior": "一句话行为描述",
     "verification": "一行可自动执行的 shell 命令",
     "state": "not_started",
     "evidence": "",
     "depends_on": ["F<依赖项>"],
     "files": ["计划修改的文件"]
   }
   ```

2. **开工前**：按 `templates/NEW_FEATURE.md` 的「开工前 Checklist」逐项确认——
   依赖已 `passing`、验证命令已备好、`files` 边界已列清。
3. **工作中**：遵守「工作中 Checklist」——WIP=1、只改 `files` 内的文件、
   不顺手重构。
4. **完成后**：跑验证命令 → 填 `evidence` → 置 `state: "passing"` →
   更新 `PROGRESS.md` → 提交（单次提交 ≤300 行）。

## 常见错误

- `verification` 写成"看看对不对"——必须是一行可自动执行的命令
- 顺手修改其他功能项的 `behavior`/`verification`（只能改自己的 `state`/`evidence`）
- 同时激活多个功能项（WIP=1）
- 验证没过就标 `passing`
