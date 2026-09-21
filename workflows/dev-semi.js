// workflows/dev-semi.js — 半自动开发工作流
//
// 用法：
//   claude --workflow dev-semi --args '需求：创建用户登录功能'
//
// 流程：
//   Phase 1: AI 拆解需求 → 输出任务计划
//   Phase 2: 人工审核 → 确认/修改/跳过
//   Phase 3: 逐个执行 → 每个任务后人工验收
//
// 为什么这样设计？
//   1. AI 拆解比人快，但可能拆错 → 所以要人审核
//   2. 全自动执行风险高，出错了难定位 → 所以每个任务后暂停
//   3. 人工验收确保质量 → 防止 AI "差不多就行"的心态

export const meta = {
  name: 'dev-semi',
  description: '半自动开发：AI 拆解 → 人工确认 → 逐个执行+验收',
  phases: [
    { title: '拆解' },
    { title: '确认' },
    { title: '执行' },
    { title: '汇总' },
  ],
}

// ========================================
// Phase 1: AI 拆解需求
// ========================================
const plan = await agent(
  `用户需求：${args.requirement}

   请完成：
   1. 读现有代码，理解项目结构
   2. 读 feature_list.json，了解已有任务
   3. 把需求拆成 3-7 个子任务
   4. 每个子任务包含：
      - id: T01, T02...（从已有任务的最大 id 往后排）
      - action: 一句话描述做什么
      - files: 要改哪些文件
      - verification: 验证命令（必须可自动执行）
      - acceptance_criteria: 验收标准（3-5 条具体可检查的条件）
      - depends_on: 依赖哪些子任务
      - priority: high / medium / low
   5. 输出 JSON 格式

   要求：
   - 粒度适中，每个任务有独立的业务意义
   - 不要拆得太细（"创建文件"不算一个任务）
   - 不要拆得太粗（一个任务不要包含前端+后端+测试）
   - 验证命令必须可自动执行，不能是"看看对不对"
   - 验收标准必须是具体可检查的，不能是"用户体验好"
   - 验收标准必须包含正向用例（正常流程能走通）
   - 验收标准必须包含反向用例（边界情况怎么处理）
   - 考虑边界情况和错误处理`,
  { label: 'plan', phase: '拆解' }
)

// ========================================
// Phase 2: 人工确认（暂停点）
// ========================================
const confirmation = await agent(
  `把任务计划整理成人类友好的审核格式：

   ${plan}

   格式要求：
   1. 列出每个任务：做什么、改哪些文件、怎么验证
   2. 画出依赖关系（用箭头表示）
   3. 标出预估复杂度（简单/中等/复杂）
   4. 标出风险点（如果有）
   5. 最后写："请确认是否开始执行，或提出修改意见"

   等待用户确认后再继续。`,
  { label: 'confirm', phase: '确认' }
)

// ========================================
// Phase 3: 逐个执行（每个任务后暂停）
// ========================================
const tasks = JSON.parse(plan).tasks
const results = []

for (const task of tasks) {
  // 执行任务
  const execResult = await agent(
    `执行子任务 ${task.id}：${task.action}

     要改的文件：${task.files}

     步骤：
     1. 读相关文件，理解上下文
     2. 编写/修改代码
     3. 运行验证：${task.verification}
     4. 失败则修复重试，最多 3 次
     5. 验证通过后，更新 feature_list.json 中 ${task.id} 的 state 为 passing，evidence 为验证输出

     规则：
     - 只改这一个任务相关的文件
     - 不要顺便重构其他代码
     - 遇到阻塞立即报告，不要默默重试
     - 保持代码风格和周围代码一致`,
    { label: `exec:${task.id}`, phase: '执行' }
  )

  // 执行后暂停，让用户验收
  const review = await agent(
    `${task.id} 已执行完毕。

     请执行范围审查：
     1. 运行 git diff --name-only → 列出改动的文件
     2. 对照任务计划中的 files 字段：${JSON.stringify(task.files)}
     3. 检查是否有计划外改动

     输出格式：
     ✓ 计划内改动：[文件列表]
     ⚠ 计划外改动：[文件列表]（理由：...）
     或
     ✓ 所有改动均在计划内

     然后输出：
     1. 具体改了什么（运行 git diff，关键部分）
     2. 验证结果
     3. 写："请验收：检查代码是否符合预期且范围受控，然后决定下一步（继续/修改/跳过/终止）"

     等待用户反馈。`,
    { label: `review:${task.id}`, phase: '执行' }
  )

  results.push({ task: task.id, exec: execResult, review: review })
}

// ========================================
// Phase 4: 最终汇总
// ========================================
const summary = await agent(
  `所有任务执行完毕。

   请输出最终报告：
   1. 每个任务的执行结果（通过/失败/跳过）
   2. 运行 make check，报告整体验证结果
   3. 运行 make status，报告功能完成情况
   4. 遗留问题（如果有）
   5. 建议下一步

   更新 PROGRESS.md，记录：
   - 本次完成了哪些任务
   - 变更日志
   - 下一步计划`,
  { label: 'summary', phase: '汇总' }
)

return { plan, results, summary }
