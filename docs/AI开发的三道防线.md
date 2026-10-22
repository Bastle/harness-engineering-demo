# AI 开发的三道防线

> 核心问题：怎么让 AI 写的代码"做对了、没做过、不会烂"？

AI 辅助开发有三个层次的质量挑战：

| 挑战 | 问题 | 后果 |
|------|------|------|
| **做对了** | 功能是否严格符合预期？ | 功能不可用、行为不符合预期 |
| **没做过** | 改动是否控制在范围内？ | 范围蔓延、无法追踪的变更 |
| **不会烂** | 长期迭代中是否保持可维护性？ | 技术债堆积、项目腐烂 |

三者缺一不可：
- 做对了但范围失控 → 项目膨胀
- 范围受控但做错了 → 功能不可用
- 做对了范围也受控但不维护 → 三个月后不可救药

---

# 第一道防线：做对了——质量保证

## 问题根因

为什么 AI 会"大概对"而不是"严格对"？

| 根因 | 表现 | 例子 |
|------|------|------|
| **需求模糊** | 自然语言天然有歧义 | "做个登录功能" → AI 自己决定了密码规则 |
| **验证太弱** | 只检查"能不能跑"，不检查"跑得对不对" | `ls file.txt` 通过了，但内容是错的 |
| **AI 的优化目标** | AI 优化的是"看起来合理"，不是"严格正确" | 生成的代码能跑，但边界情况没处理 |
| **缺少形式化契约** | 没有机器可读的"验收标准" | "用户体验好"无法自动验证 |

## 三层防线

### 第一层：规格定义层——把"想要什么"写死

**核心原则：AI 不知道你想要什么，除非你告诉它，而且要以它能验证的方式告诉它。**

#### 行为规格

不要写："做一个登录页面"
要写：

```
功能：用户登录
输入：用户名（3-20字符，只允许字母数字下划线）+ 密码（8-32字符）
正常流程：
  1. 用户输入用户名和密码
  2. 点击"登录"按钮
  3. 验证通过 → 跳转到 /dashboard
  4. 验证失败 → 显示"用户名或密码错误"（不泄露是哪个错了）
边界情况：
  - 用户名为空 → 显示"请输入用户名"
  - 密码为空 → 显示"请输入密码"
  - 用户名不存在 → 显示"用户名或密码错误"
  - 密码错误 → 显示"用户名或密码错误"
  - 连续5次密码错误 → 锁定账户30分钟
安全要求：
  - 密码必须 bcrypt 加盐哈希存储，禁止明文
  - 登录接口必须有 rate limiting（每IP每分钟最多10次）
  - JWT token 有效期24小时
```

#### 示例驱动

给 AI 看具体例子，而不是抽象描述：

```
输入：{ username: "alice", passwd: "correct_pwd" }
预期输出：{ status: 200, redirect: "/dashboard", token: "eyJ..." }

输入：{ username: "alice", passwd: "wrong_pwd" }
预期输出：{ status: 401, error: "用户名或密码错误" }

输入：{ username: "", passwd: "12345678" }
预期输出：{ status: 400, error: "请输入用户名" }
```

#### 反例驱动

明确告诉 AI "不要做什么"：

```
不要：
  - 不要在错误信息中区分"用户名不存在"和"密码错误"
  - 不要在前端暴露密码哈希
  - 不要使用 MD5 或 SHA1 哈希密码
  - 不要在 URL 中传递密码
```

### 第二层：验证层——用机器检查，不靠人眼看

**核心原则：人眼验收是最后防线，不是第一防线。能自动验证的，全部自动验证。**

#### 验证命令的粒度

```
// 当前：只检查文件存在
"verification": "ls example-project/ && cat example-project/README.md"

// 应该：检查行为是否正确
"verification": "cd example-project && npm start & sleep 2 && curl -s http://localhost:3000 | grep -q 'Hello' && kill %1"
```

验证命令应该覆盖：
- **存在性**：文件/目录是否存在
- **功能性**：代码能不能跑、输出对不对
- **安全性**：有没有硬编码密码、有没有 SQL 注入
- **一致性**：代码风格是否符合项目规范

#### 验证矩阵

为每个功能建立验证矩阵：

| 验证维度 | 命令 | 通过标准 |
|----------|------|----------|
| 编译 | `npm run build` | 0 errors, 0 warnings |
| 单元测试 | `npm test` | 全部通过 |
| 集成测试 | `npm run test:e2e` | 全部通过 |
| 类型检查 | `npx tsc --noEmit` | 0 errors |
| Lint | `npm run lint` | 0 errors |
| 安全扫描 | `npm audit` | 0 high/critical vulnerabilities |
| 性能基准 | `npm run bench` | 响应时间 < 200ms |

#### 录入证据

验证通过后，把输出贴到 feature_list.json 的 evidence 字段：

```json
{
  "id": "F01",
  "state": "passing",
  "evidence": "2026-09-21 npm test: 12/12 passing, coverage: 87%"
}
```

### 第三层：流程层——用机制防止"差不多就行"

#### 开工前：验收标准前置

在 AI 动手之前，先让它输出"我理解的验收标准"，你确认后它再开始：

```
AI：我理解这个功能的验收标准是：
1. 用户能用邮箱注册，密码必须包含大小写和数字
2. 注册成功后自动登录并跳转到首页
3. 重复邮箱注册返回 409 错误
4. 所有密码都用 bcrypt 哈希

请确认或补充。
```

#### 执行中：小步验证

不要等全部做完再验收。每完成一个小步骤就验证：

```
做完"创建用户表" → 跑数据库迁移 → 确认表结构正确
做完"注册 API" → 跑 API 测试 → 确认返回值正确
做完"注册页面" → 跑 E2E 测试 → 确认流程走通
```

#### 完成后：对抗性验收

不要只看"能不能跑"，要故意让它失败：

```
验收清单：
- [ ] 正常流程能走通吗？
- [ ] 输入为空会怎样？
- [ ] 输入超长字符串会怎样？
- [ ] 并发请求会怎样？
- [ ] 数据库挂了会怎样？
- [ ] 前端和后端的数据格式一致吗？
```

---

# 第二道防线：没做过——范围控制

## 问题根因

为什么 AI 会"做过"？

| 越界模式 | 表现 | 例子 |
|----------|------|------|
| **范围蔓延** | "顺手"改了不该改的文件 | 做登录功能时顺手重构了数据库层 |
| **过度工程** | 用远超需求的方案解决问题 | 需要一个函数，AI 写了一个框架 |
| **隐式修改** | 改了但没记录，无法追踪 | 修改了配置文件但没更新 PROGRESS.md |

根因：**AI 优化的是"问题被解决"，不是"改动最小"。** 它没有"范围"的概念，除非你告诉它。

## 四层束缚机制

### 第一层：规格层——开工前画边界

在 AI 动手之前，先让它输出"我打算改哪些文件"，你确认后它再开始：

```
AI：这个功能我计划修改以下文件：
  新建：
    - src/auth/login.ts
    - src/auth/login.test.ts
  修改：
    - src/routes/index.ts（添加 /login 路由）
  不会修改：
    - 数据库层（已有的 db.ts 不动）
    - 其他路由文件
    - 配置文件
```

**关键：明确列出"不会修改"的文件。** 告诉 AI 边界在哪，比告诉它要做什么更有效。

### 第二层：Git 层——用 hook 物理限制

#### diff 大小限制

```bash
# 检查单次提交的改动行数
DIFF_LINES=$(git diff --cached --stat | tail -1 | awk '{print $4}' | tr -d ',')
if [ "${DIFF_LINES:-0}" -gt 300 ]; then
    echo "✗ 单次提交改动 $DIFF_LINES 行，超过 300 行上限"
    echo "  请拆分成多次提交，每次不超过 300 行"
    exit 1
fi
```

#### 分支隔离

```bash
# 检查当前分支
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    echo "✗ 不允许直接提交到 main 分支"
    echo "  请先创建功能分支：git checkout -b feature/xxx"
    exit 1
fi
```

#### 敏感文件拦截

```bash
# 检查敏感文件（密钥、证书）
SENSITIVE_FILES=$(echo "$STAGED_FILES" | grep -E '\.(pem|key|p12|pfx|jks)$' || true)
if [ -n "$SENSITIVE_FILES" ]; then
    echo "✗ 发现敏感文件被提交"
    exit 1
fi
```

### 第三层：Workflow 层——执行中卡检查点

每个任务执行后加一个"范围审查"步骤：

```
请执行范围审查：
1. 运行 git diff --name-only → 列出改动的文件
2. 对照任务计划中的 files 字段
3. 检查是否有计划外改动

输出格式：
✓ 计划内改动：[文件列表]
⚠ 计划外改动：[文件列表]（理由：...）
或
✓ 所有改动均在计划内
```

### 第四层：规范层——代码里的约束

在 AGENTS.md 中明确规定：

```markdown
### 改动范围控制
8. **只改计划内的文件**：任务的 `files` 字段列出了哪些文件，就只能改哪些文件
9. **不改"看起来不好"的代码**：除非任务明确要求重构，否则不动其他代码
10. **不加"顺手优化"**：功能 A 的任务不要顺手优化功能 B 的性能
11. **配置文件不动**：除非任务明确要求修改配置，否则不改 `.json`、`.yaml`、`.env` 等
12. **依赖不升级**：除非任务明确要求升级依赖，否则不改 `package.json` 的版本号
```

把"只改这些文件"写进 feature_list.json 的 `files` 字段，作为硬约束。

---

# 第三道防线：不会烂——长期可维护性

## 问题根因

为什么 AI 开发会导致技术债？

| AI 的行为模式 | 长期后果 |
|--------------|----------|
| **只加不减** | 每次功能都加新文件/新函数，从不删除旧代码 |
| **局部优化** | 只关心当前任务能跑，不关心整体架构是否合理 |
| **风格漂移** | 每次会话可能用不同的命名、不同的模式、不同的目录结构 |
| **绕过而非修复** | 遇到旧代码有问题，加一层 wrapper 而不是修它 |
| **无记忆** | 不记得上次做了什么"临时方案"，下次又做一个新的 |

三个月后的典型场景：

```
src/
  auth/
    login.ts           # F01 做的
    login-v2.ts        # F05 重构的（但旧的没删）
    login-helper.ts    # F08 补的（和 login-v2 有重复逻辑）
    auth-utils.js      # F12 加的（为什么是 .js 不是 .ts？）
    _login_legacy.ts   # F15 标记废弃但还在用
  utils/
    format.ts          # F03 做的
    formatDate.ts      # F07 又做了一个
    formatters.ts      # F11 合并了（但前两个没删）
```

## 三层防腐机制

### 第一层：架构守护——画死边界，不允许 AI 越界

#### 架构文件（ARCHITECTURE.md）

在项目根目录维护一个架构文件，AI 开工前必须读：

```markdown
# 架构约束

## 目录结构（不可随意新增目录）
src/
  auth/        — 只放认证相关代码
  api/         — 只放 HTTP 路由和控制器
  db/          — 只放数据库模型和迁移
  utils/       — 只放纯函数工具
  types/       — 只放类型定义

## 禁止的做法
- 不要在 src/ 下新建顶层目录（除非经过架构评审）
- 不要在组件目录里放工具函数
- 不要在工具函数里放业务逻辑
- 不要在 API 层直接写 SQL

## 命名规范
- 文件：kebab-case（user-profile.ts）
- 类：PascalCase（UserProfile）
- 函数：camelCase（getUserProfile）
- 常量：SCREAMING_SNAKE_CASE（MAX_RETRY_COUNT）
```

#### 文件数量红线

```bash
# 在 init.sh 中检查
file_count=$(find src/ -name "*.ts" -o -name "*.js" | wc -l)
if [ "$file_count" -gt 50 ]; then
    echo "⚠ 文件数量 $file_count 超过 50，需要清理"
fi
```

#### 目录变更审批

```bash
# pre-commit hook 中检查是否新建了目录
new_dirs=$(git diff --cached --diff-filter=A --name-only | grep '/' | sed 's|/[^/]*$||' | sort -u)
if [ -n "$new_dirs" ]; then
    echo "⚠ 检测到新建目录："
    echo "$new_dirs"
    echo "请确认：这个目录符合 ARCHITECTURE.md 的结构约束吗？"
fi
```

### 第二层：债务追踪——让技术债可见、可管理、可偿还

#### 技术债清单（DEBT.md）

在项目根目录维护一个技术债文件：

```markdown
# 技术债清单

> 每次"暂时绕过"时，在这里记一笔。不记就会忘，忘了就会腐烂。

## 活跃债务

| ID | 来源 | 描述 | 严重程度 | 发现日期 | 偿还计划 |
|----|------|------|----------|----------|----------|
| D01 | F05 | login-v2.ts 和 login.ts 重复逻辑 | medium | 2026-09-01 | F10 时合并 |
| D02 | F08 | auth-utils.js 应该是 .ts | low | 2026-09-10 | 下次改 auth 时顺手迁移 |
| D03 | F12 | format.ts 和 formatDate.ts 重复 | high | 2026-09-15 | 立即处理 |

## 已偿还

| ID | 描述 | 偿还日期 | 偿还任务 |
|----|------|----------|----------|
| D00 | ~~user-service.ts 命名不一致~~ | 2026-09-20 | F09 |
```

#### 开工时读 DEBT.md

```markdown
## 开工前必读
1. 读 feature_list.json → 了解任务
2. 读 ARCHITECTURE.md → 了解架构约束
3. 读 DEBT.md → 了解现有债务
4. 如果本次任务涉及债务区域，优先偿还债务
```

#### 定期债务审计

```markdown
## 定期审计
- 每完成 5 个功能 → 运行 `make audit` 检查技术债
- 每完成 10 个功能 → 运行 `make refactor` 强制清理
```

### 第三层：质量门禁——用自动化手段防止退化

#### 代码重复度检查

```bash
# 检查函数名重复
duplicates=$(grep -rh "function \|const \|export " src/ | sort | uniq -d)
if [ -n "$duplicates" ]; then
    echo "⚠ 发现重复的函数/常量定义："
    echo "$duplicates"
fi
```

#### 文件大小限制

```bash
# 单个文件不超过 300 行
large_files=$(find src/ -name "*.ts" -o -name "*.js" | xargs wc -l 2>/dev/null | awk '$1 > 300 {print $2}')
if [ -n "$large_files" ]; then
    echo "⚠ 以下文件超过 300 行，需要拆分："
    echo "$large_files"
fi
```

#### 一致性检查

```bash
# 检查文件名规范
bad_names=$(find src/ -name "*.ts" | grep -E '[A-Z]')
if [ -n "$bad_names" ]; then
    echo "⚠ 以下文件名不符合 kebab-case 规范："
    echo "$bad_names"
fi

# 检查导入路径深度
deep_imports=$(grep -rn "from '\.\./\.\." src/ | head -5)
if [ -n "$deep_imports" ]; then
    echo "⚠ 发现深层相对导入，建议使用别名："
    echo "$deep_imports"
fi
```

#### 死代码检测

```bash
# 检查未引用的文件
unused=$(find src/ -name "*.ts" | while read f; do
    basename="${f##*/}"
    name="${basename%.ts}"
    count=$(grep -r "$name" src/ | grep -v "import\|export\|//" | wc -l)
    if [ "$count" -eq 0 ]; then
        echo "$f"
    fi
done)
if [ -n "$unused" ]; then
    echo "⚠ 以下文件可能未被引用："
    echo "$unused"
fi
```

---

# 三道防线的关系

```
第一道防线（质量保证）：做对了
    ↓ 验证命令 + 行为规格 + 对抗性验收
第二道防线（范围控制）：没做过
    ↓ files 约束 + git hook + 范围审查
第三道防线（长期维护）：不会烂
    ↓ 架构守护 + 债务追踪 + 质量门禁
```

| 层 | 管什么 | 频率 | 关键机制 |
|----|--------|------|----------|
| 质量保证 | 单次功能是否正确 | 每次任务 | 行为规格 + 验证命令 + 验收标准 |
| 范围控制 | 改动是否在边界内 | 每次提交 | files 字段 + pre-commit hook + 范围审查 |
| 长期维护 | 项目是否在腐烂 | 每 5-10 个功能 | ARCHITECTURE.md + DEBT.md + 质量门禁 |

---

# 核心理念

> **"Done" 的定义不是"写完了"，而是"验证通过了"。**
>
> **"范围"不是 AI 自己会遵守的，是你画给它的。**
>
> **AI 的工作模式是"加法"——只加不减。人的工作模式应该是"减法"——定期清理、合并、删除。**
>
> **长期可维护性 = AI 的生产力 × 人的清理频率。**

---

# 实施清单

## 立即可做

- [ ] 在 feature_list.json 中给每个任务加 `files` 字段（范围约束）
- [ ] 在 hooks/pre-commit 中加 diff 大小限制和分支隔离
- [ ] 在 AGENTS.md 中加改动范围控制规则
- [ ] 在 templates/NEW_FEATURE.md 中加范围控制 checklist
- [ ] 接入 MCP/Skill 等扩展能力时配套 verification（如 `node mcp-server/test.js`）

## 一周内

- [ ] 创建 ARCHITECTURE.md（架构约束）
- [ ] 创建 DEBT.md（技术债清单）
- [ ] 在 dev-semi workflow 中加范围审查步骤
- [ ] 在 init.sh 中加一致性检查

## 持续执行

- [ ] 每完成 5 个功能 → 审计技术债
- [ ] 每完成 10 个功能 → 清理重复代码
- [ ] 每完成 20 个功能 → 重构优化架构

---

> 相关阅读：docs/MCP与Skill接入实录.md（工具接入与 harness 全景整合）
