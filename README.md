<div align="center">

<img src="assets/kareno_animated.gif" alt="KARENO Tactical Code Engine Banner" width="820" />

# KARENO

**Ultra-Lightweight Autonomous Terminal Coding Agent for Termux (Android Mobile)**

`Node.js Pure Engine` · `Zero NPM Bloat` · `Bring Your Own Model (BYOM)` · `Quota Gatekeeper` · `Skills Ecosystem` · `100 Native Commands` · `Termux Touch Optimized`

</div>

---

## Overview

**KARENO** is an autonomous AI coding agent CLI engineered specifically for **Termux (Android ARM64/AArch64)**.

When you type `kareno` in Termux, it immediately boots into a full interactive mobile terminal UI—just like **OpenCode** and **Claude Code**—with instant `<20ms` cold-start latency, zero heavy runtime dependencies, and an asymmetric tactical interface tailored for narrow mobile phone viewports (45–68 columns).

### Core Mobile Architecture

1. **Instant Full CLI UI**: Launching `kareno` opens an interactive mobile terminal interface with live command completion, real-time ReAct spinners, syntax-highlighted code blocks, unified diffs, and Android haptic feedback (`termux-vibrate`).
2. **Bring Your Own Model (BYOM) Only**: Connect your own API keys across **DeepSeek**, **Anthropic Claude**, **OpenAI**, **Groq LPU**, **Google Gemini**, **OpenRouter**, or self-hosted **Local Ollama**. Zero free-model scrapers or fragile wrappers.
3. **Hard Quota & Budget Gatekeeper**: Built-in token counter, daily/session token limits, daily USD budget caps, and rate-limit (RPM) enforcement with a live prompt quota gauge (`▰▰▱▱▱▱`).
4. **Skills Ecosystem (`SKILL.md`)**: Install, create, enable, disable, and export domain-specific `SKILL.md` modules from GitHub repositories, remote URLs, or local directories.
5. **Termux Native Integration**: Native support for Termux clipboard (`termux-clipboard-get`/`set`), battery monitoring (`termux-battery-status`), device storage (`~/storage`), and Android notifications (`termux-toast`).

---

## Termux (Android) Installation

Open the **Termux** app on your Android device:

```bash
# 1. Update Termux packages and install Node.js + Git
pkg update -y && pkg install -y nodejs git termux-api

# 2. Clone the Kareno repository
git clone https://github.com/demonala/KarenoSecurityMAX-.git kareno
cd kareno

# 3. Run the mobile installer (symlinks kareno into $PREFIX/bin)
chmod +x install-termux.sh
./install-termux.sh
```

### Launching the Full CLI UI

From any folder or repository on your phone:

```bash
kareno
```

The full interactive terminal interface starts immediately:

```text
   _                                
  | | ____ _ _ __ ___ _ __   ___    
  | |/ / _` | '__/ _ \ '_ \ / _ \   
  |   < (_| | | |  __/ | | | (_) |  
  |_|\_\__,_|_|  \___|_| |_|\___/   
  ┌─ kareno v1.0.0 · Termux ARM64 ──────────────────────┐
  │ Engine    deepseek-chat (DEEPSEEK)        connected │
  │ Quota     ▰▱▱▱▱▱ 2% ($0.0012 / $5.00 limit)  30 RPM │
  │ Context   ~/my-project · git:main*         4 skills │
  └─────────────────────────────────────────────────────┘
  Type a task, or / for 100 commands (/help, /model, /quota)

kareno > 
```

---

## Connecting Your Model (BYOM)

KARENO is Bring Your Own Model. Set your provider and key once from the interactive prompt:

```text
kareno > /provider:set deepseek
kareno > /key:set sk-your-deepseek-api-key
kareno > /model:set deepseek-chat
```

### Supported Providers

| Provider ID | Provider Name | Default Model | Environment Variable Fallback |
| :--- | :--- | :--- | :--- |
| `deepseek` | DeepSeek API | `deepseek-chat` | `DEEPSEEK_API_KEY` |
| `anthropic` | Anthropic Claude | `claude-3-7-sonnet-latest` | `ANTHROPIC_API_KEY` |
| `openai` | OpenAI | `gpt-4o` | `OPENAI_API_KEY` |
| `groq` | Groq Cloud (LPU) | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| `gemini` | Google Gemini | `gemini-2.5-pro` | `GEMINI_API_KEY` |
| `openrouter` | OpenRouter | `anthropic/claude-3.7-sonnet` | `OPENROUTER_API_KEY` |
| `ollama` | Local Ollama (ARM64) | `qwen2.5-coder:7b` | `OLLAMA_API_KEY` |

Custom OpenAI-compatible mobile proxies can also be configured with `/endpoint <url>`.

---

## Quota & Budget Management

Track and protect your API spend right inside Termux:

* `/quota` : View visual quota gauge, daily token count, session tokens, and USD cost.
* `/quota:set <tokens>` : Set hard daily token ceiling (blocks calls once reached).
* `/quota:session <tokens>` : Set per-session token limit.
* `/budget <usd>` : Set maximum daily USD spend cap (e.g. `/budget 3.00`).
* `/rate <rpm>` : Enforce requests-per-minute rate limiting.
* `/cost:estimate <file>` : Inspect token count and estimated cost of reading a file before execution.

---

## Skills Ecosystem (`SKILL.md`)

KARENO ships with 4 bundled core skills:
* `termux-ops`: Mobile Android ARM64 commands, storage access, package management.
* `security-audit`: Secret leak scanning, input sanitization, OWASP checks.
* `clean-arch`: Modular clean code, strict error handling, zero AI slop.
* `perf-tuning`: V8 optimizations, algorithmic complexity reduction, low-latency I/O.

### Managing Skills on Mobile

```text
/skills                                  # List installed skills and ON/OFF status
/skill:install owner/repo                # Download and install SKILL.md from GitHub
/skill:create flutter-mobile             # Scaffold a custom skill in ~/.kareno/skills/
/skill:enable security-audit             # Enable skill
/skill:disable perf-tuning               # Disable skill to save token context
```

---

## All 100 Native Commands

### 01. Core Session & System (10)
`/help`, `/commands`, `/status`, `/clear`, `/reset`, `/exit`, `/version`, `/config`, `/doctor`, `/init`

### 02. BYOM Model & Provider Engine (10)
`/model`, `/model:set`, `/model:list`, `/provider`, `/provider:set`, `/key:set`, `/key:list`, `/key:rm`, `/temp`, `/max-tokens`

### 03. Quota, Cost & Rate Management (10)
`/quota`, `/quota:set`, `/quota:session`, `/quota:reset`, `/cost`, `/tokens`, `/budget`, `/usage`, `/rate`, `/stats`

### 04. Skills Ecosystem (10)
`/skills`, `/skill:list`, `/skill:install`, `/skill:remove`, `/skill:enable`, `/skill:disable`, `/skill:info`, `/skill:create`, `/skill:reload`, `/skill:export`

### 05. Workspace & File System (10)
`/ls`, `/tree`, `/read`, `/write`, `/edit`, `/find`, `/grep`, `/stat`, `/mkdir`, `/rm`

### 06. AI Code Engineering & Analysis (10)
`/plan`, `/review`, `/explain`, `/refactor`, `/optimize`, `/fix`, `/types`, `/deps`, `/complexity`, `/doc`

### 07. Git & Version Control (10)
`/git`, `/git:status`, `/diff`, `/log`, `/commit`, `/branch`, `/checkout`, `/stash`, `/blame`, `/undo`

### 08. Execution, Termux & Runtime (10)
`/run`, `/test`, `/build`, `/bench`, `/env`, `/ps`, `/pwd`, `/cd`, `/sysinfo`, `/termux`

### 09. Context, Memory & Checkpoints (10)
`/context`, `/compact`, `/pin`, `/unpin`, `/pins`, `/remember`, `/forget`, `/memories`, `/checkpoint`, `/restore`

### 10. Security, Crypto & Network Utilities (10)
`/audit`, `/secrets`, `/hash`, `/base64:enc`, `/base64:dec`, `/hex`, `/uuid`, `/json:fmt`, `/ip`, `/export`

---

## License

MIT License · Absolute Immortal Inc.
