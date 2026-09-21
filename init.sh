#!/bin/bash
# init.sh - 项目初始化和验证脚本
# 用法: ./init.sh [setup|test|check]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok() { echo -e "${GREEN}✓${NC} $1"; }
log_fail() { echo -e "${RED}✗${NC} $1"; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

cmd_setup() {
    log_info "检查环境..."
    
    # 检查 git
    if command -v git &> /dev/null; then
        log_ok "git 已安装: $(git --version)"
    else
        log_fail "git 未安装"
        exit 1
    fi
    
    # 检查 node
    if command -v node &> /dev/null; then
        log_ok "node 已安装: $(node --version)"
    else
        log_fail "node 未安装"
        exit 1
    fi
    
    # 检查 npm
    if command -v npm &> /dev/null; then
        log_ok "npm 已安装: $(npm --version)"
    else
        log_fail "npm 未安装"
        exit 1
    fi
    
    # 检查关键文件
    for f in AGENTS.md PROGRESS.md feature_list.json; do
        if [ -f "$f" ]; then
            log_ok "$f 存在"
        else
            log_fail "$f 缺失"
            exit 1
        fi
    done
    
    # 检查 git 状态
    if git rev-parse --git-dir > /dev/null 2>&1; then
        log_ok "git 仓库已初始化"
    else
        log_fail "git 仓库未初始化"
        exit 1
    fi
    
    log_ok "环境检查完成"
}

cmd_test() {
    log_info "运行测试..."
    
    local passed=0
    local failed=0
    
    # 测试1: AGENTS.md 存在且非空
    if [ -s AGENTS.md ]; then
        log_ok "AGENTS.md 存在且非空"
        ((passed++))
    else
        log_fail "AGENTS.md 缺失或为空"
        ((failed++))
    fi
    
    # 测试2: PROGRESS.md 存在且非空
    if [ -s PROGRESS.md ]; then
        log_ok "PROGRESS.md 存在且非空"
        ((passed++))
    else
        log_fail "PROGRESS.md 缺失或为空"
        ((failed++))
    fi
    
    # 测试3: feature_list.json 是有效 JSON
    if python3 -c "import json; json.load(open('feature_list.json'))" 2>/dev/null; then
        log_ok "feature_list.json 是有效 JSON"
        ((passed++))
    else
        log_fail "feature_list.json 不是有效 JSON"
        ((failed++))
    fi
    
    # 测试4: 没有临时文件（排除 .DS_Store 和已有子目录）
    local temp_files=$(find . -maxdepth 1 -name "*.tmp" -o -name "*.log" -o -name "*.bak" 2>/dev/null | wc -l)
    if [ "$temp_files" -eq 0 ]; then
        log_ok "无临时文件残留"
        ((passed++))
    else
        log_fail "发现 $temp_files 个临时文件"
        ((failed++))
    fi
    
    # 测试5: 没有敏感信息泄露（只检查根目录和 harness 文件，跳过已有子目录）
    local secrets=$(grep -l "password\|secret\|api_key\|API_KEY" AGENTS.md PROGRESS.md feature_list.json 2>/dev/null | wc -l)
    if [ "$secrets" -eq 0 ]; then
        log_ok "Harness 文件无敏感信息泄露"
        ((passed++))
    else
        log_fail "Harness 文件中发现敏感信息"
        ((failed++))
    fi
    
    echo ""
    echo "测试结果: $passed 通过, $failed 失败"
    
    if [ "$failed" -gt 0 ]; then
        exit 1
    fi
}

cmd_check() {
    log_info "运行完整验证..."
    cmd_setup
    echo ""
    cmd_test
    echo ""
    log_ok "完整验证通过"
}

cmd_lint() {
    log_info "运行代码风格检查..."

    local passed=0
    local failed=0

    # 检查1: feature_list.json 格式正确
    if python3 -c "import json; json.load(open('feature_list.json'))" 2>/dev/null; then
        log_ok "feature_list.json 格式正确"
        ((passed++))
    else
        log_fail "feature_list.json 格式错误"
        ((failed++))
    fi

    # 检查2: 所有 JSON 文件格式正确
    local json_errors=0
    for f in $(find . -name "*.json" -not -path "*/node_modules/*" -not -path "*/.git/*"); do
        if ! python3 -c "import json; json.load(open('$f'))" 2>/dev/null; then
            log_fail "$f 格式错误"
            ((json_errors++))
        fi
    done
    if [ "$json_errors" -eq 0 ]; then
        log_ok "所有 JSON 文件格式正确"
        ((passed++))
    else
        ((failed++))
    fi

    # 检查3: 没有临时文件
    local temp_files=$(find . -maxdepth 1 -name "*.tmp" -o -name "*.log" -o -name "*.bak" 2>/dev/null | wc -l)
    if [ "$temp_files" -eq 0 ]; then
        log_ok "无临时文件残留"
        ((passed++))
    else
        log_fail "发现 $temp_files 个临时文件"
        ((failed++))
    fi

    # 检查4: 没有敏感信息泄露
    local secrets=$(grep -rl "password\|secret\|api_key\|API_KEY" AGENTS.md PROGRESS.md feature_list.json CLAUDE.md 2>/dev/null | wc -l)
    if [ "$secrets" -eq 0 ]; then
        log_ok "无敏感信息泄露"
        ((passed++))
    else
        log_fail "发现可能的敏感信息"
        ((failed++))
    fi

    # 检查5: shell 脚本语法检查
    local shell_errors=0
    for f in init.sh hooks/pre-commit; do
        if [ -f "$f" ] && ! bash -n "$f" 2>/dev/null; then
            log_fail "$f 语法错误"
            ((shell_errors++))
        fi
    done
    if [ "$shell_errors" -eq 0 ]; then
        log_ok "Shell 脚本语法正确"
        ((passed++))
    else
        ((failed++))
    fi

    echo ""
    echo "Lint 结果: $passed 通过, $failed 失败"

    if [ "$failed" -gt 0 ]; then
        exit 1
    fi
}

cmd_status() {
    log_info "项目状态:"

    echo ""
    echo "=== Git 状态 ==="
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo "  分支: $(git branch --show-current 2>/dev/null || echo 'detached')"
        echo "  最新 commit: $(git log --oneline -1 2>/dev/null || echo '无')"
        local untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
        local modified=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
        echo "  未跟踪文件: $untracked"
        echo "  已修改文件: $modified"
    else
        echo "  不在 git 仓库中"
    fi

    echo ""
    echo "=== 功能完成情况 ==="
    if [ -f feature_list.json ]; then
        local total=$(python3 -c "import json; print(len(json.load(open('feature_list.json'))['features']))" 2>/dev/null || echo "?")
        local passing=$(python3 -c "import json; print(len([f for f in json.load(open('feature_list.json'))['features'] if f['state']=='passing']))" 2>/dev/null || echo "?")
        local in_progress=$(python3 -c "import json; print(len([f for f in json.load(open('feature_list.json'))['features'] if f['state']=='in_progress']))" 2>/dev/null || echo "?")
        local not_started=$(python3 -c "import json; print(len([f for f in json.load(open('feature_list.json'))['features'] if f['state']=='not_started']))" 2>/dev/null || echo "?")
        echo "  总计: $total"
        echo "  ✓ 通过: $passing"
        echo "  → 进行中: $in_progress"
        echo "  ○ 未开始: $not_started"
    else
        echo "  feature_list.json 不存在"
    fi

    echo ""
    echo "=== 环境 ==="
    echo "  git: $(git --version 2>/dev/null || echo '未安装')"
    echo "  node: $(node --version 2>/dev/null || echo '未安装')"
    echo "  npm: $(npm --version 2>/dev/null || echo '未安装')"
}

# 主入口
case "${1:-help}" in
    setup)  cmd_setup ;;
    test)   cmd_test ;;
    check)  cmd_check ;;
    lint)   cmd_lint ;;
    status) cmd_status ;;
    *)
        echo "用法: $0 [setup|test|check|lint|status]"
        echo "  setup  - 检查环境配置"
        echo "  test   - 运行测试"
        echo "  check  - 完整验证（setup + test）"
        echo "  lint   - 代码风格检查"
        echo "  status - 查看项目状态"
        exit 1
        ;;
esac
