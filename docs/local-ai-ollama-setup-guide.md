# Local AI Model Setup Guide (Ollama + Qwen 3.5 2B)

<p>
  <a href="#english"><strong>English</strong></a> |
  <a href="#français"><strong>Français</strong></a> |
  <a href="#简体中文"><strong>简体中文</strong></a>
</p>

---

<a id="english"></a>

## English

### 1. Architecture Overview
The Dispatch backend uses a **deterministic-first, AI-assisted** hybrid architecture:
1. **Built-in Deterministic & Semantic Engine (Priority #1 & Fallback)**: Handles all core dispatch commands, shift assignments, roster lookups, and standard leave keywords with zero external dependencies and zero latency.
2. **Optional Local Ollama LLM (`qwen3.5:2b`)**: Automatically handles unstructured natural-language leave requests (e.g. `"need to see my dentist Friday morning"`) in `OfficeConciergeService` and general Q&A in AI Copilot when `GEMINI_API_KEY` is not set.
3. **Automatic Error Logging & Graceful Fallback**: If Ollama or Gemini fails (timeout, HTTP error, or unreachable), the backend logs the failure to the system `error_logs` collection (viewable in **Web Console → Error Logs**) and falls back cleanly to the built-in engine.

### 2. Recommended VM / Hardware Specs
Tested on **Oracle Cloud Always Free ARM VM (`aarch64`)**:
- **CPU**: 2+ vCPUs (ARM64 or x86_64)
- **RAM**: 8–10 GiB+ (`qwen3.5:2b` uses ~2.5–3 GiB RAM)
- **Disk**: 15+ GB free
- **Observed Performance**: ~2.8s total response (`~11.2 tokens/s`) with thinking mode disabled (`think: false`).

### 3. Step-by-Step Installation (Linux / Oracle VM)

1. **Install `zstd` (required by the Ollama installer):**
   ```bash
   # Oracle Linux / RHEL / CentOS / Fedora
   sudo dnf install -y zstd

   # Debian / Ubuntu
   sudo apt-get update && sudo apt-get install -y zstd
   ```
2. **Install Ollama:**
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
3. **Pull and verify `qwen3.5:2b` (with thinking mode disabled):**
   ```bash
   ollama pull qwen3.5:2b
   ollama run qwen3.5:2b --think=false "Reply with OK only"
   ```
   > **Note:** `qwen3.5:2b` enables chain-of-thought thinking by default, which is slow on CPU-only VMs. The Go backend automatically passes `"think": false` and `"num_ctx": 2048` on every API call.

### 4. Backend Environment Configuration

- **Same-machine deployment (Go backend & Ollama on the same VM):**
  No password or API key is required because Ollama binds to loopback `127.0.0.1:11434` only.
  Add to your `.env` or systemd environment:
  ```env
  OLLAMA_BASE_URL=http://127.0.0.1:11434
  OLLAMA_MODEL=qwen3.5:2b
  # Optional: only needed if Ollama sits behind an authenticated reverse proxy
  # OLLAMA_API_KEY=
  ```
- **Local development (Laptop running Go server connecting to remote Oracle VM):**
  Do **not** expose port `11434` to the public internet. Instead, open an SSH tunnel from your laptop:
  ```bash
  ssh -N -L 11434:127.0.0.1:11434 opc@<ORACLE_VM_IP>
  ```
  Then set `OLLAMA_BASE_URL=http://127.0.0.1:11434` and `OLLAMA_MODEL=qwen3.5:2b` in your local `.env`.

### 5. Connecting Google Cloud Run via Cloudflare Tunnel (Recommended)

Because Google Cloud Run runs in Google's cloud, it cannot reach `127.0.0.1:11434` on your Oracle VM directly. Using **Cloudflare Tunnel + a local Nginx Bearer-token guard** keeps all inbound firewall ports closed on Oracle while giving Cloud Run a secure HTTPS endpoint:

1. **Generate a strong random `OLLAMA_API_KEY`** (do this on your VM or locally, never commit it):
   ```bash
   openssl rand -hex 32
   ```
2. **Add a local-only Nginx auth proxy (`127.0.0.1:11435` → `127.0.0.1:11434`) on the Oracle VM:**
   ```nginx
   # /etc/nginx/conf.d/ollama-proxy.conf  (outside git repo, chmod 600)
   server {
       listen 127.0.0.1:11435;
       location / {
           if ($http_authorization != "Bearer REPLACE_WITH_YOUR_RANDOM_KEY") {
               return 401;
           }
           proxy_pass http://127.0.0.1:11434;
           proxy_set_header Host 127.0.0.1;
       }
   }
   ```
3. **Install & run `cloudflared` on the Oracle VM (`aarch64`):**
   ```bash
   # Quick temporary test (URL changes on restart):
   cloudflared tunnel --url http://127.0.0.1:11435

   # Production: create a free Cloudflare Named Tunnel pointing your domain to http://127.0.0.1:11435
   ```
4. **Store the key in Google Cloud Secret Manager (NEVER in GitHub):**
   ```bash
   printf '%s' 'REPLACE_WITH_YOUR_RANDOM_KEY' | gcloud secrets create ollama-api-key --data-file=-
   gcloud run services update dispatch-api \
     --set-env-vars="OLLAMA_BASE_URL=https://ai.yourdomain.com,OLLAMA_MODEL=qwen3.5:2b" \
     --set-secrets="OLLAMA_API_KEY=ollama-api-key:latest"
   ```

### 6. Verification
1. **Web Console UI**: Open **Settings → Dispatch AI Copilot Operations Hub** and click **Test AI Connection**. It displays the active engine, model name, latency (`ms`), and reply.
2. **Ollama Service Logs (on VM)**:
   ```bash
   journalctl -u ollama -f
   ```
   Look for `POST "/api/chat" 200` when testing from the Web Console.

---

<a id="français"></a>

## Français

### 1. Architecture
Le backend utilise une approche **déterministe d'abord, assistée par IA** :
1. **Moteur sémantique intégré (Priorité n°1 et secours)** : Traite toutes les commandes de répartition et mots-clés de congé sans dépendance externe.
2. **Ollama local optionnel (`qwen3.5:2b`)** : Extrait les demandes de congé en langage naturel libre et répond aux questions générales lorsque `GEMINI_API_KEY` n'est pas configuré.
3. **Journalisation automatique des erreurs** : En cas d'échec (délai dépassé, erreur HTTP), l'erreur est enregistrée dans `error_logs` (visible dans **Error Logs**) et le système bascule automatiquement vers le moteur intégré.

### 2. Installation rapide (VM Linux / Oracle Cloud)
```bash
# 1. Installer zstd (Oracle Linux / RHEL : dnf ; Debian / Ubuntu : apt-get)
sudo dnf install -y zstd

# 2. Installer Ollama et télécharger qwen3.5:2b
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3.5:2b
ollama run qwen3.5:2b --think=false "Reply with OK only"
```

### 3. Configuration `.env` et tunnel SSH
- **Sur la même machine** (aucun mot de passe requis sur `127.0.0.1`) :
  ```env
  OLLAMA_BASE_URL=http://127.0.0.1:11434
  OLLAMA_MODEL=qwen3.5:2b
  ```
- **Développement local vers une VM distante** :
  ```bash
  ssh -N -L 11434:127.0.0.1:11434 opc@<ORACLE_VM_IP>
  ```

- **Cloud Run via Cloudflare Tunnel (recommandé, aucun port entrant à ouvrir)** :
  1. Générez une clé secrète (`openssl rand -hex 32`) et protégez `127.0.0.1:11434` via Nginx local (`127.0.0.1:11435`) vérifiant `Authorization: Bearer <CLÉ>`.
  2. Exposez `http://127.0.0.1:11435` avec `cloudflared tunnel`.
  3. Enregistrez la clé dans **Google Cloud Secret Manager** (`--set-secrets="OLLAMA_API_KEY=ollama-api-key:latest"`) sans jamais l'écrire dans le dépôt Git.

### 4. Vérification
Dans la console Web, ouvrez **Paramètres système → Dispatch AI Copilot Operations Hub** et cliquez sur **Tester la connexion IA**.

---

<a id="简体中文"></a>

## 简体中文

### 1. 架构说明
Dispatch 后端采用 **“确定性规则优先 + 本地小模型补充”** 的混合架构：
1. **内置确定性规则引擎（第一优先级 & 兜底）**：0 外部依赖、毫秒级响应，处理所有标准调度指令、班次查询与常规请假关键词。
2. **可选本地 Ollama 小模型（`qwen3.5:2b`）**：当未配置 `GEMINI_API_KEY` 时，用于处理未命中关键词的口语化请假意图提取（`OfficeConciergeService`）以及 AI Copilot 通用问答（`AIService`）。
3. **异常自动落库与无感回退**：若 AI 调用超时、连接失败或返回非 2xx 错误，后端会自动将错误详情写入系统 `error_logs`（可在 Web 端 **Error Logs** 页面查看），同时静默回退至内置引擎，确保业务不中断。

### 2. 推荐配置（已实测）
已在 **Oracle Cloud Always Free ARM 虚拟机（`aarch64`）** 实测通过：
- **CPU**：2 vCPUs（ARM64 或 x86_64 均可）
- **内存**：8–10 GiB+（`qwen3.5:2b` 运行约占 2.5–3 GiB）
- **磁盘**：15 GB 以上可用空间
- **实测速度**：关闭思考模式（`think: false`）后总耗时约 `2.8s`（约 `11.2 tokens/s`）。

### 3. 安装步骤（Linux / Oracle VM）

1. **安装解压依赖 `zstd`**：
   ```bash
   # Oracle Linux / RHEL / CentOS / Fedora
   sudo dnf install -y zstd

   # Debian / Ubuntu
   sudo apt-get update && sudo apt-get install -y zstd
   ```
2. **安装 Ollama**：
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
3. **拉取并验证 `qwen3.5:2b`（关闭思考模式）**：
   ```bash
   ollama pull qwen3.5:2b
   ollama run qwen3.5:2b --think=false "Reply with OK only"
   ```
   > **提示**：`qwen3.5:2b` 默认会输出冗长思考过程，在纯 CPU 机器上很慢。Go 后端每次请求都会自动携带 `"think": false` 和 `"num_ctx": 2048`。

### 4. 后端环境变量配置

- **同机部署（Go 后端与 Ollama 在同一台虚拟机上）**：
  Ollama 默认只监听本机回环 `127.0.0.1:11434`，**不需要密码或 API Key**。在 `.env` 中加入：
  ```env
  OLLAMA_BASE_URL=http://127.0.0.1:11434
  OLLAMA_MODEL=qwen3.5:2b
  # 仅当通过带鉴权的反向代理访问 Ollama 时才需要设置
  # OLLAMA_API_KEY=
  ```
- **本地电脑联调远程虚拟机上的 Ollama**：
  **切勿**将 `11434` 端口直接暴露到公网。在本地终端建立一条 SSH 端口转发隧道即可：
  ```bash
  ssh -N -L 11434:127.0.0.1:11434 opc@<ORACLE_VM_IP>
  ```
  随后在本地 `.env` 中配置 `OLLAMA_BASE_URL=http://127.0.0.1:11434` 即可。

### 5. Google Cloud Run 通过 Cloudflare Tunnel 安全连接（推荐）

由于 Go 后端部署在 Google Cloud Run 上，无法直接访问 Oracle 虚拟机内部的 `127.0.0.1:11434`。使用 **Cloudflare Tunnel + 本机 Nginx 密钥鉴权**，既无需开放 Oracle 入站防火墙端口，又能防止公网白嫖：

1. **生成高强度随机密钥**（仅保存在服务端运行环境，切勿写入代码仓库）：
   ```bash
   openssl rand -hex 32
   ```
2. **在 Oracle VM 上配置仅监听本机的 Nginx 鉴权代理（`127.0.0.1:11435` → `127.0.0.1:11434`）**：
   ```nginx
   # /etc/nginx/conf.d/ollama-proxy.conf（位于 Git 仓库外，建议 chmod 600）
   server {
       listen 127.0.0.1:11435;
       location / {
           if ($http_authorization != "Bearer 替换为你的随机密钥") {
               return 401;
           }
           proxy_pass http://127.0.0.1:11434;
           proxy_set_header Host 127.0.0.1;
       }
   }
   ```
3. **在 Oracle VM 上运行 `cloudflared`**：
   ```bash
   # 临时测试隧道（重启会变域名）：
   cloudflared tunnel --url http://127.0.0.1:11435

   # 正式生产：在 Cloudflare 免费创建 Named Tunnel 绑定固定域名指向 http://127.0.0.1:11435
   ```
4. **在 Google Cloud Run 中通过 Secret Manager 注入密钥（绝对不进 GitHub）**：
   ```bash
   printf '%s' '替换为你的随机密钥' | gcloud secrets create ollama-api-key --data-file=-
   gcloud run services update dispatch-api \
     --set-env-vars="OLLAMA_BASE_URL=https://ai.你的域名.com,OLLAMA_MODEL=qwen3.5:2b" \
     --set-secrets="OLLAMA_API_KEY=ollama-api-key:latest"
   ```

### 6. 如何确保密钥永远不会泄露到 GitHub？
- **代码与配置模板零硬编码**：`.env.example`、`cloudbuild.yaml`、部署脚本及 Go/TS 源码中**只写变量名**（`OLLAMA_API_KEY`），绝不写实际密钥值。
- **Cloud Run 走 Secret Manager / 控制台环境变量**：密钥保存在 GCP Secret Manager 或 Cloud Run 控制台的 **Variables & Secrets** 中，不落盘到仓库。
- **Oracle VM 配置文件放在仓库外**：Nginx 配置在 `/etc/nginx/conf.d/`（`chmod 600`），与 Git 工作目录完全隔离。
- **本地开发走 `.gitignore`**：本地 `.env` 已被 `.gitignore`（`**/.env`）自动忽略，不会被 `git add` 提交。

### 7. 验证方法
1. **Web 控制台一键测试**：进入 **System Settings → Dispatch AI Copilot Operations Hub**，点击 **Test AI Connection** 按钮，即可查看当前引擎、模型名、响应耗时（ms）和返回结果。
2. **查看 Ollama 实时日志（在虚拟机上）**：
   ```bash
   journalctl -u ollama -f
   ```
   测试时看到 `POST "/api/chat" 200` 即表示链路完全正常。
