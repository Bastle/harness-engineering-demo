# Makefile — 统一任务入口
#
# 为什么需要 Makefile？
# 1. 给项目一个"标准接口"——不管项目多复杂，入口永远是 make xxx
# 2. AI 助手只需要知道几个 make 命令，不需要记住每个脚本的路径和参数
# 3. 可以在 target 之间建立依赖关系（比如 check = setup + test + lint）
#
# 用法：make [target]
#   make setup   — 检查环境配置
#   make test    — 运行测试
#   make check   — 完整验证（setup + test + lint）
#   make lint    — 代码/文件风格检查
#   make status  — 查看项目状态
#   make clean   — 清理临时文件
#   make help    — 显示帮助

.PHONY: setup test check lint status clean help

# 默认目标：显示帮助
.DEFAULT_GOAL := help

# 环境检查
# 验证 git、node、npm 是否安装，关键文件是否存在
setup:
	@echo "→ 检查环境..."
	@./init.sh setup

# 运行测试
# 执行 init.sh 中的所有测试用例（含 MCP 握手自测 node mcp-server/test.js）
test:
	@echo "→ 运行测试..."
	@./init.sh test

# 代码风格检查
# 验证 JSON 格式、敏感信息、Skill frontmatter 字段
lint:
	@echo "→ 运行 lint..."
	@./init.sh lint

# 完整验证：环境 + 测试 + lint
# 这是提交前应该跑的命令
check:
	@./init.sh check

# 查看项目状态
# 显示 git 状态和功能完成情况
status:
	@./init.sh status

# 清理临时文件
clean:
	@echo "→ 清理临时文件..."
	@find . -name "*.tmp" -o -name "*.log" -o -name "*.bak" | xargs rm -f 2>/dev/null || true
	@echo "✓ 清理完成"

# 帮助信息
help:
	@echo "Harness Demo — 可用命令："
	@echo ""
	@echo "  make setup    检查环境配置"
	@echo "  make test     运行测试"
	@echo "  make lint     代码/文件风格检查"
	@echo "  make check    完整验证（推荐提交前运行）"
	@echo "  make status   查看项目状态"
	@echo "  make clean    清理临时文件"
	@echo "  make help     显示此帮助"
