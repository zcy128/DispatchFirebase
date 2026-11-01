# 强制将终端输出编码设置为 UTF-8，防止 Cursor 读取中文时乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 使用 $args 接收命令行传入的所有路径参数（支持同时传 1 个或多个目录）
if ($args.Count -gt 0) {
    $TargetPaths = $args -join ", "
    $ScopeInstruction = "请同时深度读取并交叉检查以下目录中的所有相关代码文件：[$TargetPaths]。如果当前工作区也有 git diff 改动，请重点结合检查。"
} else {
    $gitStatus = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($gitStatus)) {
        Write-Output "PASS: 当前没有任何代码改动，且未指定检查目录。"
        exit 0
    }
    $ScopeInstruction = "请运行 git diff 查看当前工作区的所有代码改动，并结合项目上下文文件进行深度检查。"
}

# 定义检查者 (Reviewer) 的核心提示词
$PROMPT = @"
你现在是一个极其严苛的资深代码审查员（Code Reviewer）。
$ScopeInstruction

【检查标准】：
1. 跨目录/跨端 API 调用一致性（重点检查）：
   - 检查调用方（如 parent app）请求的路由路径（URL）、HTTP 方法（GET/POST/PUT/DELETE 等）是否在 API 目录中真实存在且完全匹配。
   - 检查调用方传入的参数（Query / Body / Headers）字段名、数据类型是否与 API 端接收和校验的定义严格一致。
   - 检查 API 返回的数据结构（Response 格式、状态码）在调用方是否被正确解析，是否遗漏了错误处理（如 4xx/5xx 异常捕获）。
2. 逻辑漏洞、边界条件未处理或潜在的空指针/未定义错误。
3. 安全隐患（如注入风险、硬编码敏感信息、未授权访问）。
4. 严重的性能问题或内存泄漏隐患。
5. firebase安全问题和性能优化
6. API server的安全问题和性能优化
7. 对外边链接和webhook的安全问题，访问外部API链接中密码用户名的存储安全问题。
8. react/flutter app的性能优化。
9. 语法错误、类型不匹配或调用了不存在的函数/模块。

【输出规则（必须严格遵守）】：
- 严禁修改任何文件！你只有只读和审查权限。
- 如果发现任何上述问题，请以清晰的列表形式输出：[文件路径] + [行号] + [具体错误原因] + [修改建议]。
- 如果代码质量极高、完全没有任何问题，请仅仅输出唯一的一个词：PASS
"@

# 调用 Antigravity 无头模式与沙盒模式
agy -p $PROMPT --sandbox --dangerously-skip-permissions --output-format text