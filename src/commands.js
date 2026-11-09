'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const UI = require('./ui');
const { PROVIDERS, saveConfig, KARENO_DIR } = require('./config');
const { executeTool, resolveWorkspacePath } = require('./tools');

const COMMAND_CATALOG = [
  // 01. Core Session & System (10)
  { cmd: '/help', cat: '01. CORE', desc: 'Show categorized command summary or /help <domain>' },
  { cmd: '/commands', cat: '01. CORE', desc: 'List all 100 native Kareno slash commands' },
  { cmd: '/status', cat: '01. CORE', desc: 'Display engine, provider, quota, and workspace telemetry' },
  { cmd: '/clear', cat: '01. CORE', desc: 'Clear terminal screen and reset active conversation buffer' },
  { cmd: '/reset', cat: '01. CORE', desc: 'Reset conversation messages while preserving configuration' },
  { cmd: '/exit', cat: '01. CORE', desc: 'Terminate Kareno CLI session cleanly' },
  { cmd: '/version', cat: '01. CORE', desc: 'Show Kareno version, Node V8 build, and platform arch' },
  { cmd: '/config', cat: '01. CORE', desc: 'Inspect active configuration in ~/.kareno/config.json' },
  { cmd: '/doctor', cat: '01. CORE', desc: 'Run diagnostic checks on runtime, keys, git, and Termux' },
  { cmd: '/init', cat: '01. CORE', desc: 'Initialize KARENO.md project context file in workspace' },

  // 02. BYOM Model & Provider Control (10)
  { cmd: '/model', cat: '02. MODEL', desc: 'Show current active model and parameters' },
  { cmd: '/model:set', cat: '02. MODEL', desc: 'Set active model ID (e.g. /model:set deepseek-chat)' },
  { cmd: '/model:list', cat: '02. MODEL', desc: 'List supported models across all configured providers' },
  { cmd: '/provider', cat: '02. MODEL', desc: 'Show active LLM provider and endpoint URL' },
  { cmd: '/provider:set', cat: '02. MODEL', desc: 'Switch provider (deepseek|anthropic|openai|groq|gemini|openrouter|ollama)' },
  { cmd: '/key:set', cat: '02. MODEL', desc: 'Save API key for active or specified provider (/key:set [prov] <key>)' },
  { cmd: '/key:list', cat: '02. MODEL', desc: 'List configured provider API keys (masked)' },
  { cmd: '/key:rm', cat: '02. MODEL', desc: 'Remove stored API key for a provider' },
  { cmd: '/temp', cat: '02. MODEL', desc: 'Set sampling temperature (0.0 to 2.0)' },
  { cmd: '/max-tokens', cat: '02. MODEL', desc: 'Set maximum output tokens per completion' },

  // 03. Quota, Cost & Rate Management (10)
  { cmd: '/quota', cat: '03. QUOTA', desc: 'Show live token quota gauge, daily spend, and session usage' },
  { cmd: '/quota:set', cat: '03. QUOTA', desc: 'Set daily token quota limit (e.g. /quota:set 1000000)' },
  { cmd: '/quota:session', cat: '03. QUOTA', desc: 'Set per-session token ceiling (e.g. /quota:session 250000)' },
  { cmd: '/quota:reset', cat: '03. QUOTA', desc: 'Reset daily and session token counters to zero' },
  { cmd: '/cost', cat: '03. QUOTA', desc: 'Display detailed USD cost breakdown for session and lifetime' },
  { cmd: '/tokens', cat: '03. QUOTA', desc: 'Show input/output token counts and context window fill' },
  { cmd: '/budget', cat: '03. QUOTA', desc: 'Set daily USD budget hard cap (e.g. /budget 5.00)' },
  { cmd: '/usage', cat: '03. QUOTA', desc: 'Show historical usage breakdown per LLM provider' },
  { cmd: '/rate', cat: '03. QUOTA', desc: 'Set maximum requests-per-minute (RPM) rate limit' },
  { cmd: '/stats', cat: '03. QUOTA', desc: 'Show session performance metrics and average token velocity' },

  // 04. Skills Ecosystem (10)
  { cmd: '/skills', cat: '04. SKILLS', desc: 'Show active and available Kareno skills' },
  { cmd: '/skill:list', cat: '04. SKILLS', desc: 'List all bundled, user, and workspace skills with status' },
  { cmd: '/skill:install', cat: '04. SKILLS', desc: 'Install skill from path, URL, or GitHub owner/repo' },
  { cmd: '/skill:remove', cat: '04. SKILLS', desc: 'Uninstall a user skill from ~/.kareno/skills' },
  { cmd: '/skill:enable', cat: '04. SKILLS', desc: 'Enable a skill module for the agent prompt' },
  { cmd: '/skill:disable', cat: '04. SKILLS', desc: 'Disable a skill module' },
  { cmd: '/skill:info', cat: '04. SKILLS', desc: 'Inspect full instructions and metadata of a skill' },
  { cmd: '/skill:create', cat: '04. SKILLS', desc: 'Scaffold a new custom skill (/skill:create <name> <desc>)' },
  { cmd: '/skill:reload', cat: '04. SKILLS', desc: 'Hot-reload all SKILL.md files from disk' },
  { cmd: '/skill:export', cat: '04. SKILLS', desc: 'Export a skill definition to the current directory' },

  // 05. Workspace & File System (10)
  { cmd: '/ls', cat: '05. FILES', desc: 'List files and directories with sizes (/ls [path])' },
  { cmd: '/tree', cat: '05. FILES', desc: 'Render hierarchical directory tree of the workspace' },
  { cmd: '/read', cat: '05. FILES', desc: 'Read file with line numbers (/read <file> [start] [end])' },
  { cmd: '/write', cat: '05. FILES', desc: 'Write inline content to a file (/write <file> <text>)' },
  { cmd: '/edit', cat: '05. FILES', desc: 'Instruct agent to edit a target file with a prompt' },
  { cmd: '/find', cat: '05. FILES', desc: 'Find files by name substring across the workspace' },
  { cmd: '/grep', cat: '05. FILES', desc: 'Search file contents by regex or text (/grep <pattern>)' },
  { cmd: '/stat', cat: '05. FILES', desc: 'Show detailed file metadata, timestamps, and SHA-256' },
  { cmd: '/mkdir', cat: '05. FILES', desc: 'Create directory recursively (/mkdir <dir>)' },
  { cmd: '/rm', cat: '05. FILES', desc: 'Delete a file in the workspace (/rm <file>)' },

  // 06. AI Code Engineering & Analysis (10)
  { cmd: '/plan', cat: '06. CODE', desc: 'Generate step-by-step architectural plan without editing files' },
  { cmd: '/review', cat: '06. CODE', desc: 'Perform code review on a file or current git diff' },
  { cmd: '/explain', cat: '06. CODE', desc: 'Explain how a file or function works (/explain <file>)' },
  { cmd: '/refactor', cat: '06. CODE', desc: 'Refactor target file for modularity and clean structure' },
  { cmd: '/optimize', cat: '06. CODE', desc: 'Analyze and optimize file for runtime and memory speed' },
  { cmd: '/fix', cat: '06. CODE', desc: 'Diagnose and repair syntax or runtime errors in a file' },
  { cmd: '/types', cat: '06. CODE', desc: 'Add JSDoc / TypeScript type annotations to a file' },
  { cmd: '/deps', cat: '06. CODE', desc: 'Inspect package.json, requirements.txt, or Cargo.toml dependencies' },
  { cmd: '/complexity', cat: '06. CODE', desc: 'Compute line count, function count, and nesting depth of a file' },
  { cmd: '/doc', cat: '06. CODE', desc: 'Generate technical documentation for a module' },

  // 07. Git & Version Control (10)
  { cmd: '/git', cat: '07. GIT', desc: 'Run any git subcommand directly (/git <args>)' },
  { cmd: '/git:status', cat: '07. GIT', desc: 'Show short git working tree status' },
  { cmd: '/diff', cat: '07. GIT', desc: 'Show current unstaged and staged git diff' },
  { cmd: '/log', cat: '07. GIT', desc: 'Display recent git commit graph (--oneline -n 10)' },
  { cmd: '/commit', cat: '07. GIT', desc: 'Stage all changes and commit with message (/commit <msg>)' },
  { cmd: '/branch', cat: '07. GIT', desc: 'List or create git branches' },
  { cmd: '/checkout', cat: '07. GIT', desc: 'Switch git branch or restore path' },
  { cmd: '/stash', cat: '07. GIT', desc: 'Stash or pop local working tree changes' },
  { cmd: '/blame', cat: '07. GIT', desc: 'Show line-by-line git blame for a file (/blame <file>)' },
  { cmd: '/undo', cat: '07. GIT', desc: 'Discard unstaged modifications to a file (/undo <file>)' },

  // 08. Execution, Termux & Runtime (10)
  { cmd: '/run', cat: '08. EXEC', desc: 'Execute shell command in workspace (/run <cmd>)' },
  { cmd: '/test', cat: '08. EXEC', desc: 'Run project test suite (npm test / pytest / cargo test)' },
  { cmd: '/build', cat: '08. EXEC', desc: 'Run project build pipeline' },
  { cmd: '/bench', cat: '08. EXEC', desc: 'Benchmark execution latency of a command (/bench <cmd>)' },
  { cmd: '/env', cat: '08. EXEC', desc: 'Display safe runtime environment variables' },
  { cmd: '/ps', cat: '08. EXEC', desc: 'List running processes on the system' },
  { cmd: '/pwd', cat: '08. EXEC', desc: 'Show current working directory path' },
  { cmd: '/cd', cat: '08. EXEC', desc: 'Change current working directory (/cd <dir>)' },
  { cmd: '/sysinfo', cat: '08. EXEC', desc: 'Show CPU, RAM, OS kernel, and uptime telemetry' },
  { cmd: '/termux', cat: '08. EXEC', desc: 'Show Termux prefix, Android architecture, and battery/storage status' },

  // 09. Context, Memory & Checkpoints (10)
  { cmd: '/context', cat: '09. CONTEXT', desc: 'Inspect active conversation context size and pinned files' },
  { cmd: '/compact', cat: '09. CONTEXT', desc: 'Compress conversation history to free up context window' },
  { cmd: '/pin', cat: '09. CONTEXT', desc: 'Pin a file into persistent system context (/pin <file>)' },
  { cmd: '/unpin', cat: '09. CONTEXT', desc: 'Remove a file from pinned context (/unpin <file>)' },
  { cmd: '/pins', cat: '09. CONTEXT', desc: 'List all currently pinned context files' },
  { cmd: '/remember', cat: '09. CONTEXT', desc: 'Save a persistent rule or note to memory (/remember <note>)' },
  { cmd: '/forget', cat: '09. CONTEXT', desc: 'Remove a memory note by index (/forget <index>)' },
  { cmd: '/memories', cat: '09. CONTEXT', desc: 'List all saved persistent memory notes' },
  { cmd: '/checkpoint', cat: '09. CONTEXT', desc: 'Save current conversation state to a named checkpoint' },
  { cmd: '/restore', cat: '09. CONTEXT', desc: 'Restore conversation state from a named checkpoint' },

  // 10. Security, Crypto & Network Utilities (10)
  { cmd: '/audit', cat: '10. SEC', desc: 'Scan workspace for insecure patterns and dependency risks' },
  { cmd: '/secrets', cat: '10. SEC', desc: 'Scan workspace files for hardcoded API keys and tokens' },
  { cmd: '/hash', cat: '10. SEC', desc: 'Calculate SHA-256 and MD5 of a string or file (/hash <target>)' },
  { cmd: '/base64:enc', cat: '10. SEC', desc: 'Encode text to Base64' },
  { cmd: '/base64:dec', cat: '10. SEC', desc: 'Decode Base64 string to UTF-8' },
  { cmd: '/hex', cat: '10. SEC', desc: 'Convert string or file header to hexadecimal dump' },
  { cmd: '/uuid', cat: '10. SEC', desc: 'Generate cryptographically random UUID v4' },
  { cmd: '/json:fmt', cat: '10. SEC', desc: 'Validate and pretty-print a JSON file (/json:fmt <file>)' },
  { cmd: '/ip', cat: '10. SEC', desc: 'Display local network interface IPv4/IPv6 addresses' },
  { cmd: '/export', cat: '10. SEC', desc: 'Export session transcript to Markdown (/export [filename])' }
];

function buildTree(dir, prefix = '', depth = 0, out = []) {
  if (depth > 3 || out.length > 80) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }).filter(
      e => !['node_modules', '.git', '__pycache__'].includes(e.name)
    );
  } catch (_) {
    return out;
  }
  entries.forEach((e, idx) => {
    const isLast = idx === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    out.push(`${prefix}${branch}${e.name}${e.isDirectory() ? '/' : ''}`);
    if (e.isDirectory()) {
      buildTree(path.join(dir, e.name), prefix + (isLast ? '    ' : '│   '), depth + 1, out);
    }
  });
  return out;
}

async function handleSlashCommand(input, ctx) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg1 = parts[1] || '';
  const rest = parts.slice(1).join(' ');
  const { config, quota, skills, messages, checkpoints, runAgentPrompt } = ctx;
  const { C } = UI;

  // ── 01. CORE SESSION & SYSTEM ──
  if (cmd === '/help') {
    const filter = arg1.toUpperCase();
    const groups = {};
    for (const item of COMMAND_CATALOG) {
      if (filter && !item.cat.includes(filter) && !item.cmd.includes(arg1.toLowerCase())) continue;
      if (!groups[item.cat]) groups[item.cat] = [];
      groups[item.cat].push([item.cmd, item.desc]);
    }
    for (const [cat, rows] of Object.entries(groups)) {
      console.log('\n' + UI.spineBlock(`KARENO COMMANDS // ${cat}`, rows, C.GREEN));
    }
    console.log(`\n  ${C.SLATE}Total registered commands: ${C.WHITE}${COMMAND_CATALOG.length}${C.SLATE} · Filter with ${C.CYAN}/help <domain>${C.RESET}`);
    return { handled: true };
  }

  if (cmd === '/commands') {
    const rows = COMMAND_CATALOG.map((item, i) => [
      `${String(i + 1).padStart(3, '0')}. ${item.cmd}`,
      `[${item.cat.split('.')[1].trim()}] ${item.desc}`
    ]);
    console.log('\n' + UI.spineBlock('ALL 100 NATIVE KARENO COMMANDS', rows, C.CYAN));
    return { handled: true };
  }

  if (cmd === '/status') {
    const q = quota.getSummary();
    const activeSkills = skills.listAll().filter(s => s.enabled).map(s => s.name).join(', ') || 'none';
    console.log('\n' + UI.spineBlock('KARENO SYSTEM TELEMETRY', [
      ['Runtime', `Node ${process.version} (${os.platform()}/${os.arch()})`],
      ['Environment', UI.isTermux() ? 'Termux Android ARM' : 'Standard Desktop/Server CLI'],
      ['Active Provider', config.provider],
      ['Active Model', config.model],
      ['API Key Status', config.apiKeys[config.provider] ? 'Configured' : 'Missing (/key:set)'],
      ['Daily Quota', `${q.dailyTokens.toLocaleString()} / ${q.dailyTokenLimit.toLocaleString()} tokens (${q.dailyPercent.toFixed(1)}%)`],
      ['Daily Spend', `$${q.dailyCost.toFixed(4)} / $${q.dailyBudgetUsd.toFixed(2)} USD`],
      ['Active Skills', activeSkills],
      ['Pinned Files', String(config.pinnedFiles.length)],
      ['Context Messages', String(messages.length)]
    ], C.GREEN));
    return { handled: true };
  }

  if (cmd === '/clear') {
    process.stdout.write('\x1b[2J\x1b[H');
    messages.length = 0;
    const activeSkillsCount = skills.listAll().filter(s => s.enabled).length;
    console.log(UI.headerBanner(config, quota.getSummary(), activeSkillsCount));
    return { handled: true };
  }

  if (cmd === '/reset') {
    messages.length = 0;
    UI.info('Conversation context buffer cleared.');
    return { handled: true };
  }

  if (cmd === '/exit' || cmd === '/quit') {
    UI.info('Terminating Kareno session.');
    process.exit(0);
  }

  if (cmd === '/version') {
    console.log(UI.spineBlock('VERSION METADATA', [
      ['Engine', 'KARENO CLI v1.0.0'],
      ['Node Runtime', process.version],
      ['V8 Engine', process.versions.v8],
      ['Architecture', `${os.platform()} ${os.arch()} (${os.release()})`],
      ['Author', 'demonala // Hendry (Absolute Immortal Inc.)']
    ]));
    return { handled: true };
  }

  if (cmd === '/config') {
    const safeCfg = { ...config, apiKeys: Object.fromEntries(Object.keys(config.apiKeys).map(k => [k, '***MASKED***'])) };
    console.log(UI.spineBlock('CONFIGURATION (~/.kareno/config.json)', Object.entries(safeCfg).map(([k, v]) => [k, JSON.stringify(v)])));
    return { handled: true };
  }

  if (cmd === '/doctor') {
    let gitOk = 'Not Found';
    try { gitOk = execSync('git --version', { encoding: 'utf8' }).trim(); } catch (_) {}
    const isTx = UI.isTermux();
    const rows = [
      ['Node Runtime', `PASS (${process.version})`],
      ['Mobile Container', isTx ? 'PASS (Termux Android ARM)' : 'Mobile Emulation Mode'],
      ['Config Directory', fs.existsSync(KARENO_DIR) ? `PASS (${KARENO_DIR})` : 'FAIL'],
      ['Active Provider', `${config.provider} (${config.model})`],
      ['Provider API Key', config.apiKeys[config.provider] || config.provider === 'ollama' ? 'PASS (Connected)' : 'MISSING (Run /key:set)'],
      ['Git Binary', gitOk],
      ['Terminal Columns', `${UI.getCols()} cols`],
      ['Loaded Skills', `${skills.listAll().length} available (${skills.listAll().filter(s => s.enabled).length} enabled)`],
      ['Native Commands', `${COMMAND_CATALOG.length} / 100 Verified`]
    ];
    console.log('\n' + UI.spineBlock('KARENO MOBILE DIAGNOSTIC DOCTOR', rows, C.CYAN));
    return { handled: true };
  }

  if (cmd === '/init') {
    const target = path.join(process.cwd(), 'KARENO.md');
    if (fs.existsSync(target)) {
      UI.warn('KARENO.md already exists in this workspace.');
    } else {
      const template = [
        '# KARENO Workspace Instructions',
        '',
        '## Project Overview',
        `- Workspace: ${path.basename(process.cwd())}`,
        '- Architecture: Modular, high-velocity, zero-slop implementation.',
        '',
        '## Build & Test Commands',
        '- Run: `npm start`',
        '- Test: `npm test`',
        '',
        '## Coding Rules',
        '- Write complete implementations without placeholder comments.',
        '- Preserve existing formatting and handle all error states explicitly.'
      ].join('\n');
      fs.writeFileSync(target, template, 'utf8');
      UI.info(`Created project instructions file: ${target}`);
    }
    return { handled: true };
  }

  // ── 02. BYOM MODEL & PROVIDER CONTROL ──
  if (cmd === '/model') {
    console.log(UI.spineBlock('ACTIVE MODEL CONFIGURATION', [
      ['Provider', config.provider],
      ['Model ID', config.model],
      ['Temperature', String(config.temperature)],
      ['Max Tokens', String(config.maxTokens)],
      ['Context Limit', `${config.contextWindowLimit.toLocaleString()} tokens`]
    ]));
    return { handled: true };
  }

  if (cmd === '/model:set') {
    if (!arg1) {
      UI.warn('Usage: /model:set <model_id> (e.g. /model:set deepseek-reasoner)');
      return { handled: true };
    }
    config.model = arg1;
    saveConfig(config);
    UI.info(`Active model updated to: ${config.model}`);
    return { handled: true };
  }

  if (cmd === '/model:list') {
    const rows = Object.entries(PROVIDERS).map(([k, v]) => [
      `${k} (${v.name})`,
      v.models.join(', ')
    ]);
    console.log('\n' + UI.spineBlock('SUPPORTED BYOM PROVIDERS & MODELS', rows, C.CYAN));
    return { handled: true };
  }

  if (cmd === '/provider') {
    const p = PROVIDERS[config.provider] || {};
    console.log(UI.spineBlock('PROVIDER DETAILS', [
      ['Provider Key', config.provider],
      ['Display Name', p.name || 'Custom'],
      ['Endpoint URL', config.customBaseUrl || p.baseUrl || 'N/A'],
      ['Input Price / 1M', `$${p.pricingPer1M ? p.pricingPer1M.input.toFixed(2) : '0.00'}`],
      ['Output Price / 1M', `$${p.pricingPer1M ? p.pricingPer1M.output.toFixed(2) : '0.00'}`]
    ]));
    return { handled: true };
  }

  if (cmd === '/provider:set') {
    const pKey = arg1.toLowerCase();
    if (!PROVIDERS[pKey]) {
      UI.warn(`Unknown provider "${arg1}". Choose: ${Object.keys(PROVIDERS).join(', ')}`);
      return { handled: true };
    }
    config.provider = pKey;
    config.model = PROVIDERS[pKey].defaultModel;
    saveConfig(config);
    UI.info(`Switched provider to ${PROVIDERS[pKey].name} (default model: ${config.model})`);
    return { handled: true };
  }

  if (cmd === '/key:set') {
    if (!arg1) {
      UI.warn('Usage: /key:set <api_key> OR /key:set <provider> <api_key>');
      return { handled: true };
    }
    let targetProv = config.provider;
    let keyVal = arg1;
    if (parts[2] && PROVIDERS[arg1.toLowerCase()]) {
      targetProv = arg1.toLowerCase();
      keyVal = parts[2];
    }
    config.apiKeys[targetProv] = keyVal;
    saveConfig(config);
    UI.info(`API key saved for provider "${targetProv}".`);
    return { handled: true };
  }

  if (cmd === '/key:list') {
    const rows = Object.keys(PROVIDERS).map(k => {
      const val = config.apiKeys[k];
      const masked = val ? `${val.slice(0, 5)}...${val.slice(-4)}` : 'NOT SET';
      return [k, masked];
    });
    console.log('\n' + UI.spineBlock('CONFIGURED API KEYS', rows));
    return { handled: true };
  }

  if (cmd === '/key:rm') {
    const targetProv = (arg1 || config.provider).toLowerCase();
    delete config.apiKeys[targetProv];
    saveConfig(config);
    UI.info(`Removed API key for "${targetProv}".`);
    return { handled: true };
  }

  if (cmd === '/temp') {
    const val = parseFloat(arg1);
    if (isNaN(val) || val < 0 || val > 2) {
      UI.warn('Usage: /temp <0.0 - 2.0>');
      return { handled: true };
    }
    config.temperature = val;
    saveConfig(config);
    UI.info(`Temperature set to ${val}`);
    return { handled: true };
  }

  if (cmd === '/max-tokens') {
    const val = parseInt(arg1, 10);
    if (isNaN(val) || val < 128) {
      UI.warn('Usage: /max-tokens <number> (min 128)');
      return { handled: true };
    }
    config.maxTokens = val;
    saveConfig(config);
    UI.info(`Max output tokens set to ${val}`);
    return { handled: true };
  }

  // ── 03. QUOTA, COST & RATE MANAGEMENT ──
  if (cmd === '/quota') {
    const q = quota.getSummary();
    console.log('\n' + UI.spineBlock('QUOTA & BUDGET TELEMETRY', [
      ['Date', q.date],
      ['Quota Gauge', `${UI.quotaGauge(q.dailyPercent, 12)} ${q.dailyPercent.toFixed(1)}%`],
      ['Daily Tokens', `${q.dailyTokens.toLocaleString()} / ${q.dailyTokenLimit.toLocaleString()} (In: ${q.dailyInputTokens.toLocaleString()}, Out: ${q.dailyOutputTokens.toLocaleString()})`],
      ['Session Tokens', `${q.sessionTokens.toLocaleString()} / ${q.sessionTokenLimit.toLocaleString()}`],
      ['Daily Cost (USD)', `$${q.dailyCost.toFixed(4)} / $${q.dailyBudgetUsd.toFixed(2)}`],
      ['Session Cost (USD)', `$${q.sessionCost.toFixed(4)}`],
      ['Rate Limit (RPM)', `${q.currentRpm} / ${q.rpmLimit} req/min`]
    ], C.GREEN));
    return { handled: true };
  }

  if (cmd === '/quota:set') {
    const limit = parseInt(arg1, 10);
    if (isNaN(limit) || limit < 1000) {
      UI.warn('Usage: /quota:set <daily_token_limit> (e.g. /quota:set 500000)');
      return { handled: true };
    }
    quota.state.dailyTokenLimit = limit;
    quota.save();
    UI.info(`Daily token quota ceiling updated to ${limit.toLocaleString()} tokens.`);
    return { handled: true };
  }

  if (cmd === '/quota:session') {
    const limit = parseInt(arg1, 10);
    if (isNaN(limit) || limit < 1000) {
      UI.warn('Usage: /quota:session <session_token_limit>');
      return { handled: true };
    }
    quota.state.sessionTokenLimit = limit;
    quota.save();
    UI.info(`Session token ceiling updated to ${limit.toLocaleString()} tokens.`);
    return { handled: true };
  }

  if (cmd === '/quota:reset') {
    quota.resetDaily();
    UI.info('Daily and session token/cost counters reset to 0.');
    return { handled: true };
  }

  if (cmd === '/cost') {
    const q = quota.getSummary();
    console.log('\n' + UI.spineBlock('COST LEDGER (USD)', [
      ['Session Spend', `$${q.sessionCost.toFixed(5)} (${q.sessionRequests} requests)`],
      ['Daily Spend', `$${q.dailyCost.toFixed(5)} (${q.dailyRequests} requests)`],
      ['Daily Budget Cap', `$${q.dailyBudgetUsd.toFixed(2)}`],
      ['Lifetime Spend', `$${q.lifetimeCostUsd.toFixed(4)} (${q.lifetimeRequests} total requests)`]
    ], C.AMBER));
    return { handled: true };
  }

  if (cmd === '/tokens') {
    const q = quota.getSummary();
    const ctxChars = messages.reduce((acc, m) => acc + String(m.content || '').length, 0);
    const estCtxTokens = Math.ceil(ctxChars / 3.8);
    console.log('\n' + UI.spineBlock('TOKEN METRICS', [
      ['Active Context Buffer', `~${estCtxTokens.toLocaleString()} / ${config.contextWindowLimit.toLocaleString()} tokens`],
      ['Session Input / Output', `${q.sessionInputTokens.toLocaleString()} in / ${q.sessionOutputTokens.toLocaleString()} out`],
      ['Daily Input / Output', `${q.dailyInputTokens.toLocaleString()} in / ${q.dailyOutputTokens.toLocaleString()} out`],
      ['Lifetime Total', `${q.lifetimeTokens.toLocaleString()} tokens`]
    ]));
    return { handled: true };
  }

  if (cmd === '/budget') {
    const usd = parseFloat(arg1);
    if (isNaN(usd) || usd < 0) {
      UI.warn('Usage: /budget <daily_usd_cap> (e.g. /budget 10.00)');
      return { handled: true };
    }
    quota.state.dailyBudgetUsd = usd;
    quota.save();
    UI.info(`Daily USD budget cap set to $${usd.toFixed(2)}.`);
    return { handled: true };
  }

  if (cmd === '/usage') {
    const q = quota.getSummary();
    const rows = Object.entries(q.providerUsage).map(([prov, u]) => [
      prov.toUpperCase(),
      `${u.tokens.toLocaleString()} tok · $${u.costUsd.toFixed(4)} · ${u.requests} reqs`
    ]);
    console.log('\n' + UI.spineBlock('USAGE BY PROVIDER', rows.length ? rows : [['(none)', 'No requests recorded yet']]));
    return { handled: true };
  }

  if (cmd === '/rate') {
    const rpm = parseInt(arg1, 10);
    if (isNaN(rpm) || rpm < 1) {
      UI.warn('Usage: /rate <max_requests_per_minute>');
      return { handled: true };
    }
    quota.state.rpmLimit = rpm;
    quota.save();
    UI.info(`Rate limit updated to ${rpm} RPM.`);
    return { handled: true };
  }

  if (cmd === '/stats') {
    const q = quota.getSummary();
    const avgTok = q.sessionRequests > 0 ? Math.round(q.sessionTokens / q.sessionRequests) : 0;
    console.log('\n' + UI.spineBlock('SESSION STATS', [
      ['Session Requests', String(q.sessionRequests)],
      ['Avg Tokens / Req', String(avgTok)],
      ['Memory Heap Used', `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`],
      ['Process Uptime', `${Math.floor(process.uptime())}s`]
    ]));
    return { handled: true };
  }

  // ── 04. SKILLS ECOSYSTEM ──
  if (cmd === '/skills' || cmd === '/skill:list') {
    const all = skills.listAll();
    const rows = all.map(s => [
      `${s.enabled ? '[ON] ' : '[OFF]'} ${s.name}`,
      `(${s.source}) ${s.description}`
    ]);
    console.log('\n' + UI.spineBlock(`KARENO SKILLS ECOSYSTEM (${all.length})`, rows, C.CYAN));
    return { handled: true };
  }

  if (cmd === '/skill:install') {
    if (!arg1) {
      UI.warn('Usage: /skill:install <local_path | url | github_owner/repo>');
      return { handled: true };
    }
    UI.info(`Installing skill from "${arg1}"...`);
    const res = await skills.installFromSource(arg1);
    if (res.ok) {
      saveConfig(config);
      UI.info(`Installed and enabled skill "${res.name}" (${res.path})`);
    } else {
      UI.error(`Skill install failed: ${res.error}`);
    }
    return { handled: true };
  }

  if (cmd === '/skill:remove') {
    if (!arg1) {
      UI.warn('Usage: /skill:remove <skill_name>');
      return { handled: true };
    }
    const res = skills.removeSkill(arg1);
    if (res.ok) {
      saveConfig(config);
      UI.info(`Removed skill "${arg1}".`);
    } else {
      UI.error(res.reason);
    }
    return { handled: true };
  }

  if (cmd === '/skill:enable') {
    if (skills.enable(arg1)) {
      saveConfig(config);
      UI.info(`Enabled skill "${arg1}".`);
    } else {
      UI.error(`Skill "${arg1}" not found.`);
    }
    return { handled: true };
  }

  if (cmd === '/skill:disable') {
    if (skills.disable(arg1)) {
      saveConfig(config);
      UI.info(`Disabled skill "${arg1}".`);
    } else {
      UI.warn(`Skill "${arg1}" was not enabled.`);
    }
    return { handled: true };
  }

  if (cmd === '/skill:info') {
    const s = skills.skills.get(arg1);
    if (!s) {
      UI.error(`Skill "${arg1}" not found.`);
      return { handled: true };
    }
    console.log('\n' + UI.spineBlock(`SKILL // ${s.name}`, [
      ['Description', s.description],
      ['Version', s.version],
      ['Source', s.source],
      ['Path', s.path],
      ['Instructions', s.instructions.slice(0, 300) + (s.instructions.length > 300 ? '...' : '')]
    ]));
    return { handled: true };
  }

  if (cmd === '/skill:create') {
    if (!arg1) {
      UI.warn('Usage: /skill:create <name> [description]');
      return { handled: true };
    }
    const desc = parts.slice(2).join(' ') || 'Custom Kareno domain skill';
    const created = skills.createSkill(arg1, desc);
    saveConfig(config);
    UI.info(`Created and enabled skill "${created.name}" at ${created.path}`);
    return { handled: true };
  }

  if (cmd === '/skill:reload') {
    const count = skills.reload();
    UI.info(`Reloaded ${count} skills from disk.`);
    return { handled: true };
  }

  if (cmd === '/skill:export') {
    const s = skills.skills.get(arg1);
    if (!s) {
      UI.error(`Skill "${arg1}" not found.`);
      return { handled: true };
    }
    const dest = path.join(process.cwd(), `${s.name}.SKILL.md`);
    fs.copyFileSync(s.path, dest);
    UI.info(`Exported skill to ${dest}`);
    return { handled: true };
  }

  // ── 05. WORKSPACE & FILE SYSTEM ──
  if (cmd === '/ls') {
    console.log(executeTool('list_dir', { path: arg1 || '.' }));
    return { handled: true };
  }

  if (cmd === '/tree') {
    const root = resolveWorkspacePath(arg1 || '.');
    const lines = buildTree(root);
    console.log('\n' + UI.spineBlock(`TREE // ${path.basename(root)}`, lines.map(l => [l])));
    return { handled: true };
  }

  if (cmd === '/read') {
    if (!arg1) {
      UI.warn('Usage: /read <file> [start_line] [end_line]');
      return { handled: true };
    }
    console.log(executeTool('read_file', { path: arg1, start_line: parts[2], end_line: parts[3] }));
    return { handled: true };
  }

  if (cmd === '/write') {
    if (!arg1 || parts.length < 3) {
      UI.warn('Usage: /write <file> <content>');
      return { handled: true };
    }
    console.log(executeTool('write_file', { path: arg1, content: parts.slice(2).join(' ') }));
    return { handled: true };
  }

  if (cmd === '/edit') {
    if (!arg1) {
      UI.warn('Usage: /edit <file> <instructions>');
      return { handled: true };
    }
    await runAgentPrompt(`Read and edit file "${arg1}" according to these instructions: ${parts.slice(2).join(' ')}`);
    return { handled: true };
  }

  if (cmd === '/find') {
    if (!arg1) {
      UI.warn('Usage: /find <filename_substring>');
      return { handled: true };
    }
    const matches = [];
    function searchNames(d, depth = 0) {
      if (depth > 5 || matches.length >= 50) return;
      let list = [];
      try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
      for (const e of list) {
        if (['node_modules', '.git'].includes(e.name)) continue;
        const full = path.join(d, e.name);
        if (e.name.toLowerCase().includes(arg1.toLowerCase())) {
          matches.push(path.relative(process.cwd(), full));
        }
        if (e.isDirectory()) searchNames(full, depth + 1);
      }
    }
    searchNames(process.cwd());
    console.log(UI.spineBlock(`FIND // "${arg1}" (${matches.length})`, matches.length ? matches.map(m => [m]) : [['No matching files']]));
    return { handled: true };
  }

  if (cmd === '/grep') {
    if (!arg1) {
      UI.warn('Usage: /grep <pattern> [dir]');
      return { handled: true };
    }
    console.log(executeTool('grep_code', { query: arg1, directory: parts[2] }));
    return { handled: true };
  }

  if (cmd === '/stat') {
    if (!arg1) {
      UI.warn('Usage: /stat <file>');
      return { handled: true };
    }
    const full = resolveWorkspacePath(arg1);
    if (!fs.existsSync(full)) {
      UI.error(`Path not found: ${arg1}`);
      return { handled: true };
    }
    const st = fs.statSync(full);
    const hash = st.isFile() ? crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') : 'DIR';
    console.log(UI.spineBlock(`STAT // ${arg1}`, [
      ['Size', `${st.size.toLocaleString()} bytes`],
      ['Modified', st.mtime.toISOString()],
      ['Mode', st.mode.toString(8)],
      ['SHA-256', hash]
    ]));
    return { handled: true };
  }

  if (cmd === '/mkdir') {
    if (!arg1) {
      UI.warn('Usage: /mkdir <directory>');
      return { handled: true };
    }
    const full = resolveWorkspacePath(arg1);
    fs.mkdirSync(full, { recursive: true });
    UI.info(`Created directory: ${arg1}`);
    return { handled: true };
  }

  if (cmd === '/rm') {
    if (!arg1) {
      UI.warn('Usage: /rm <file>');
      return { handled: true };
    }
    const full = resolveWorkspacePath(arg1);
    if (!fs.existsSync(full)) {
      UI.error(`File not found: ${arg1}`);
      return { handled: true };
    }
    fs.rmSync(full, { force: true });
    UI.info(`Removed: ${arg1}`);
    return { handled: true };
  }

  // ── 06. AI CODE ENGINEERING & ANALYSIS ──
  if (cmd === '/plan') {
    if (!rest) { UI.warn('Usage: /plan <feature or architecture task>'); return { handled: true }; }
    await runAgentPrompt(`[PLAN MODE - DO NOT MODIFY FILES YET] Create a concrete technical implementation plan for: ${rest}`);
    return { handled: true };
  }

  if (cmd === '/review') {
    const targetDesc = arg1 ? `file "${arg1}"` : 'the current git diff and workspace changes';
    await runAgentPrompt(`Perform a rigorous technical code review on ${targetDesc}. Identify bugs, edge cases, security flaws, and performance bottlenecks.`);
    return { handled: true };
  }

  if (cmd === '/explain') {
    if (!arg1) { UI.warn('Usage: /explain <file_or_symbol>'); return { handled: true }; }
    await runAgentPrompt(`Read and explain the architecture, control flow, and purpose of "${rest}".`);
    return { handled: true };
  }

  if (cmd === '/refactor') {
    if (!arg1) { UI.warn('Usage: /refactor <file> [goal]'); return { handled: true }; }
    await runAgentPrompt(`Refactor "${arg1}" to improve modularity, readability, and error handling. ${parts.slice(2).join(' ')}`);
    return { handled: true };
  }

  if (cmd === '/optimize') {
    if (!arg1) { UI.warn('Usage: /optimize <file>'); return { handled: true }; }
    await runAgentPrompt(`Optimize "${arg1}" for execution speed, algorithmic complexity, and low memory allocation.`);
    return { handled: true };
  }

  if (cmd === '/fix') {
    if (!rest) { UI.warn('Usage: /fix <file_or_error>'); return { handled: true }; }
    await runAgentPrompt(`Diagnose and fix the issue in: ${rest}`);
    return { handled: true };
  }

  if (cmd === '/types') {
    if (!arg1) { UI.warn('Usage: /types <file>'); return { handled: true }; }
    await runAgentPrompt(`Add accurate type annotations or JSDoc signatures to "${arg1}".`);
    return { handled: true };
  }

  if (cmd === '/deps') {
    const pkgPath = resolveWorkspacePath('package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.entries({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      console.log(UI.spineBlock('PROJECT DEPENDENCIES (package.json)', deps.length ? deps : [['(zero dependencies)', 'Pure standalone package']]));
    } else {
      UI.info('No package.json found in current directory.');
    }
    return { handled: true };
  }

  if (cmd === '/complexity') {
    if (!arg1) { UI.warn('Usage: /complexity <file>'); return { handled: true }; }
    const full = resolveWorkspacePath(arg1);
    if (!fs.existsSync(full)) { UI.error(`File not found: ${arg1}`); return { handled: true }; }
    const text = fs.readFileSync(full, 'utf8');
    const lines = text.split('\n');
    const funcs = (text.match(/\b(function|def|fn|func)\b|=>/g) || []).length;
    const branches = (text.match(/\b(if|else|switch|case|for|while|catch)\b/g) || []).length;
    console.log(UI.spineBlock(`COMPLEXITY // ${arg1}`, [
      ['Total Lines', String(lines.length)],
      ['Non-Empty Lines', String(lines.filter(l => l.trim()).length)],
      ['Functions / Closures', String(funcs)],
      ['Branch Points', String(branches)],
      ['Cyclomatic Estimate', String(branches + 1)]
    ]));
    return { handled: true };
  }

  if (cmd === '/doc') {
    if (!arg1) { UI.warn('Usage: /doc <file>'); return { handled: true }; }
    await runAgentPrompt(`Generate concise, accurate technical documentation for "${arg1}".`);
    return { handled: true };
  }

  // ── 07. GIT & VERSION CONTROL ──
  if (cmd === '/git') {
    console.log(executeTool('run_command', { command: `git ${rest || 'status -s'}` }));
    return { handled: true };
  }

  if (cmd === '/git:status') {
    console.log(executeTool('run_command', { command: 'git status -sb' }));
    return { handled: true };
  }

  if (cmd === '/diff') {
    console.log(executeTool('run_command', { command: `git diff ${rest}` }));
    return { handled: true };
  }

  if (cmd === '/log') {
    console.log(executeTool('run_command', { command: 'git log --oneline --graph -n 12' }));
    return { handled: true };
  }

  if (cmd === '/commit') {
    if (!rest) { UI.warn('Usage: /commit <commit_message>'); return { handled: true }; }
    console.log(executeTool('run_command', { command: `git add -A && git commit -m "${rest.replace(/"/g, '\\"')}"` }));
    return { handled: true };
  }

  if (cmd === '/branch') {
    console.log(executeTool('run_command', { command: `git branch ${rest}` }));
    return { handled: true };
  }

  if (cmd === '/checkout') {
    if (!arg1) { UI.warn('Usage: /checkout <branch_or_path>'); return { handled: true }; }
    console.log(executeTool('run_command', { command: `git checkout ${rest}` }));
    return { handled: true };
  }

  if (cmd === '/stash') {
    console.log(executeTool('run_command', { command: `git stash ${rest}` }));
    return { handled: true };
  }

  if (cmd === '/blame') {
    if (!arg1) { UI.warn('Usage: /blame <file>'); return { handled: true }; }
    console.log(executeTool('run_command', { command: `git blame -L 1,40 "${arg1}"` }));
    return { handled: true };
  }

  if (cmd === '/undo') {
    if (!arg1) { UI.warn('Usage: /undo <file>'); return { handled: true }; }
    console.log(executeTool('run_command', { command: `git checkout -- "${arg1}"` }));
    return { handled: true };
  }

  // ── 08. EXECUTION, TERMUX & RUNTIME ──
  if (cmd === '/run') {
    if (!rest) { UI.warn('Usage: /run <shell_command>'); return { handled: true }; }
    console.log(executeTool('run_command', { command: rest }));
    return { handled: true };
  }

  if (cmd === '/test') {
    console.log(executeTool('run_command', { command: rest || 'npm test' }));
    return { handled: true };
  }

  if (cmd === '/build') {
    console.log(executeTool('run_command', { command: rest || 'npm run build' }));
    return { handled: true };
  }

  if (cmd === '/bench') {
    if (!rest) { UI.warn('Usage: /bench <command>'); return { handled: true }; }
    const t0 = process.hrtime.bigint();
    const out = executeTool('run_command', { command: rest });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(out);
    UI.info(`Benchmark elapsed: ${ms.toFixed(2)} ms`);
    return { handled: true };
  }

  if (cmd === '/env') {
    const safeKeys = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PREFIX', 'TERMUX_VERSION', 'NODE_ENV'];
    const rows = safeKeys.map(k => [k, (process.env[k] || '(unset)').slice(0, 60)]);
    console.log(UI.spineBlock('ENVIRONMENT VARIABLES', rows));
    return { handled: true };
  }

  if (cmd === '/ps') {
    let psOut = '';
    try {
      psOut = execSync(os.platform() === 'win32' ? 'tasklist' : 'ps', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore']
      });
    } catch (e) {
      psOut = e.stdout || e.message;
    }
    const lines = (psOut || '').trim().split('\n').slice(0, 18).join('\n');
    console.log(lines || '(no processes listed)');
    return { handled: true };
  }

  if (cmd === '/pwd') {
    UI.info(`Working Directory: ${process.cwd()}`);
    return { handled: true };
  }

  if (cmd === '/cd') {
    if (!arg1) { UI.warn('Usage: /cd <directory>'); return { handled: true }; }
    const target = resolveWorkspacePath(arg1);
    process.chdir(target);
    UI.info(`Changed directory to: ${process.cwd()}`);
    return { handled: true };
  }

  if (cmd === '/sysinfo') {
    const cpus = os.cpus();
    console.log(UI.spineBlock('HARDWARE & OS TELEMETRY', [
      ['OS Platform', `${os.type()} ${os.release()} (${os.arch()})`],
      ['CPU Model', cpus[0] ? cpus[0].model : 'ARM/Mobile'],
      ['CPU Cores', String(cpus.length)],
      ['Total RAM', `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`],
      ['Free RAM', `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`],
      ['System Uptime', `${(os.uptime() / 3600).toFixed(1)} hours`]
    ]));
    return { handled: true };
  }

  if (cmd === '/termux') {
    const isTx = UI.isTermux();
    let batteryInfo = 'N/A';
    try {
      const raw = execSync('termux-battery-status', {
        encoding: 'utf8',
        timeout: 500,
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const b = JSON.parse(raw);
      batteryInfo = `${b.percentage}% (${b.status})`;
    } catch (_) {}

    const storagePath = path.join(os.homedir(), 'storage');
    const storageStatus = fs.existsSync(storagePath) ? 'Linked (~/storage)' : 'App Sandbox';

    console.log(UI.spineBlock('TERMUX ENVIRONMENT AUDIT', [
      ['Termux Detected', isTx ? 'YES (Active Android Container)' : 'Simulated Mobile Container'],
      ['PREFIX Path', process.env.PREFIX || '/data/data/com.termux/files/usr'],
      ['Android Storage', storageStatus],
      ['Device Battery', batteryInfo],
      ['Terminal Columns', `${UI.getCols()} cols`],
      ['Arch / Endianness', `${os.arch()} / ${os.endianness()}`]
    ], C.CYAN));
    return { handled: true };
  }

  // ── 09. CONTEXT, MEMORY & CHECKPOINTS ──
  if (cmd === '/context') {
    const chars = messages.reduce((a, m) => a + String(m.content || '').length, 0);
    console.log(UI.spineBlock('ACTIVE CONTEXT STATE', [
      ['Conversation Turns', String(messages.length)],
      ['Estimated Tokens', `~${Math.ceil(chars / 3.8).toLocaleString()} tokens`],
      ['Pinned Files', config.pinnedFiles.join(', ') || '(none)'],
      ['Memory Notes', String(config.memoryNotes.length)]
    ]));
    return { handled: true };
  }

  if (cmd === '/compact') {
    if (messages.length <= 4) {
      UI.info('Context buffer is already compact.');
      return { handled: true };
    }
    const kept = messages.slice(-4);
    const droppedCount = messages.length - kept.length;
    messages.length = 0;
    messages.push({
      role: 'user',
      content: `[System Note: Compacted ${droppedCount} earlier turns to conserve token quota.]`
    }, ...kept);
    UI.info(`Compacted ${droppedCount} messages. Active turns: ${messages.length}`);
    return { handled: true };
  }

  if (cmd === '/pin') {
    if (!arg1) { UI.warn('Usage: /pin <file>'); return { handled: true }; }
    if (!fs.existsSync(resolveWorkspacePath(arg1))) {
      UI.error(`File not found: ${arg1}`);
      return { handled: true };
    }
    if (!config.pinnedFiles.includes(arg1)) {
      config.pinnedFiles.push(arg1);
      saveConfig(config);
    }
    UI.info(`Pinned "${arg1}" into persistent agent context.`);
    return { handled: true };
  }

  if (cmd === '/unpin') {
    config.pinnedFiles = config.pinnedFiles.filter(f => f !== arg1);
    saveConfig(config);
    UI.info(`Unpinned "${arg1}".`);
    return { handled: true };
  }

  if (cmd === '/pins') {
    console.log(UI.spineBlock('PINNED CONTEXT FILES', config.pinnedFiles.length ? config.pinnedFiles.map(f => [f]) : [['(none)']]));
    return { handled: true };
  }

  if (cmd === '/remember') {
    if (!rest) { UI.warn('Usage: /remember <persistent_rule_or_note>'); return { handled: true }; }
    config.memoryNotes.push(rest);
    saveConfig(config);
    UI.info(`Saved memory note #${config.memoryNotes.length}.`);
    return { handled: true };
  }

  if (cmd === '/forget') {
    const idx = parseInt(arg1, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= config.memoryNotes.length) {
      UI.warn('Usage: /forget <1-based-index> (view indices with /memories)');
      return { handled: true };
    }
    const removed = config.memoryNotes.splice(idx, 1);
    saveConfig(config);
    UI.info(`Forgot memory: "${removed[0]}"`);
    return { handled: true };
  }

  if (cmd === '/memories') {
    const rows = config.memoryNotes.map((m, i) => [`#${i + 1}`, m]);
    console.log(UI.spineBlock('PERSISTENT AGENT MEMORIES', rows.length ? rows : [['(empty)', 'Add notes with /remember <text>']]));
    return { handled: true };
  }

  if (cmd === '/checkpoint') {
    const name = arg1 || `cp-${Date.now()}`;
    checkpoints.set(name, JSON.parse(JSON.stringify(messages)));
    UI.info(`Saved conversation checkpoint "${name}" (${messages.length} turns).`);
    return { handled: true };
  }

  if (cmd === '/restore') {
    if (!arg1 || !checkpoints.has(arg1)) {
      UI.warn(`Checkpoint "${arg1}" not found. Available: ${Array.from(checkpoints.keys()).join(', ') || 'none'}`);
      return { handled: true };
    }
    const saved = checkpoints.get(arg1);
    messages.length = 0;
    messages.push(...JSON.parse(JSON.stringify(saved)));
    UI.info(`Restored checkpoint "${arg1}" (${messages.length} turns).`);
    return { handled: true };
  }

  // ── 10. SECURITY, CRYPTO & NETWORK UTILITIES ──
  if (cmd === '/audit') {
    const hits = executeTool('grep_code', { query: '(eval\\(|child_process|execSync|innerHTML|dangerouslySetInnerHTML)' });
    console.log(UI.spineBlock('STATIC SECURITY AUDIT', [[hits]]));
    return { handled: true };
  }

  if (cmd === '/secrets') {
    const hits = executeTool('grep_code', { query: '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|PRIVATE KEY)' });
    console.log(UI.spineBlock('SECRET LEAK SCANNER', [[hits]]));
    return { handled: true };
  }

  if (cmd === '/hash') {
    if (!rest) { UI.warn('Usage: /hash <string_or_filepath>'); return { handled: true }; }
    const full = resolveWorkspacePath(rest);
    const buf = fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full) : Buffer.from(rest, 'utf8');
    console.log(UI.spineBlock('CRYPTOGRAPHIC HASHES', [
      ['MD5', crypto.createHash('md5').update(buf).digest('hex')],
      ['SHA-1', crypto.createHash('sha1').update(buf).digest('hex')],
      ['SHA-256', crypto.createHash('sha256').update(buf).digest('hex')],
      ['SHA-512', crypto.createHash('sha512').update(buf).digest('hex').slice(0, 64) + '...']
    ]));
    return { handled: true };
  }

  if (cmd === '/base64:enc') {
    UI.info(Buffer.from(rest, 'utf8').toString('base64'));
    return { handled: true };
  }

  if (cmd === '/base64:dec') {
    UI.info(Buffer.from(rest, 'base64').toString('utf8'));
    return { handled: true };
  }

  if (cmd === '/hex') {
    UI.info(Buffer.from(rest, 'utf8').toString('hex'));
    return { handled: true };
  }

  if (cmd === '/uuid') {
    UI.info(crypto.randomUUID());
    return { handled: true };
  }

  if (cmd === '/json:fmt') {
    if (!arg1) { UI.warn('Usage: /json:fmt <file.json>'); return { handled: true }; }
    const full = resolveWorkspacePath(arg1);
    const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    fs.writeFileSync(full, JSON.stringify(parsed, null, 2), 'utf8');
    UI.info(`Formatted JSON file: ${arg1}`);
    return { handled: true };
  }

  if (cmd === '/ip') {
    const nets = os.networkInterfaces();
    const rows = [];
    for (const [name, addrs] of Object.entries(nets)) {
      for (const a of addrs || []) {
        if (!a.internal) rows.push([`${name} (${a.family})`, a.address]);
      }
    }
    console.log(UI.spineBlock('LOCAL NETWORK INTERFACES', rows.length ? rows : [['Loopback', '127.0.0.1']]));
    return { handled: true };
  }

  if (cmd === '/export') {
    const outFile = arg1 || `kareno-session-${Date.now()}.md`;
    const md = messages.map(m => `### ${m.role.toUpperCase()}\n\n${m.content || '(tool call)'}\n`).join('\n---\n\n');
    fs.writeFileSync(resolveWorkspacePath(outFile), md, 'utf8');
    UI.info(`Session transcript exported to ${outFile}`);
    return { handled: true };
  }

  return { handled: false };
}

module.exports = {
  COMMAND_CATALOG,
  handleSlashCommand
};
