'use strict';

const os = require('os');
const { execSync } = require('child_process');

const C = {
  GREEN: '\x1b[38;2;16;185;129m',    // Emerald #10b981
  AMBER: '\x1b[38;2;245;158;11m',    // Warm Amber #f59e0b
  RED: '\x1b[38;2;239;68;68m',       // Rose Red #ef4444
  CYAN: '\x1b[38;2;6;182;212m',      // Electric Cyan #06b6d4
  SLATE: '\x1b[38;2;100;116;139m',   // Muted Slate #64748b
  DARK: '\x1b[38;2;51;65;85m',       // Subtle Border #334155
  WHITE: '\x1b[38;2;241;245;249m',   // Crisp White #f1f5f9
  MUTED: '\x1b[38;2;148;163;184m',   // Secondary Text #94a3b8
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RESET: '\x1b[0m'
};

function getCols() {
  const c = process.stdout.columns || 60;
  return Math.max(38, Math.min(c, 80));
}

function isTermux() {
  return Boolean(
    process.env.TERMUX_VERSION ||
    (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) ||
    os.release().toLowerCase().includes('android') ||
    fs_exists_safe('/data/data/com.termux/files/usr')
  );
}

function fs_exists_safe(p) {
  try {
    return require('fs').existsSync(p);
  } catch (_) {
    return false;
  }
}

function vibrateMobile(ms = 40) {
  try {
    execSync(`termux-vibrate -d ${ms}`, { stdio: 'ignore', timeout: 400 });
  } catch (_) {}
}

function toastMobile(message) {
  try {
    execSync(`termux-toast "${message.replace(/"/g, '\\"')}"`, { stdio: 'ignore', timeout: 600 });
  } catch (_) {}
}

function quotaGauge(percent, size = 6) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((clamped / 100) * size);
  const empty = Math.max(0, size - filled);
  const color = clamped >= 85 ? C.RED : clamped >= 60 ? C.AMBER : C.GREEN;
  return `${color}${'▰'.repeat(filled)}${C.DARK}${'▱'.repeat(empty)}${C.RESET}`;
}

function getGitBranch() {
  try {
    const b = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      timeout: 800,
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    if (b) {
      const dirty = execSync('git status --porcelain', {
        encoding: 'utf8',
        timeout: 800,
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim() ? '*' : '';
      return `${b}${dirty}`;
    }
  } catch (_) {}
  return '';
}

function cleanBanner(config, quotaInfo, skillCount) {
  const cols = getCols();
  const rule = `${C.DARK}${'─'.repeat(Math.min(cols, 56))}${C.RESET}`;
  const branch = getGitBranch();
  const branchTag = branch ? `${C.SLATE}·${C.RESET} ${C.AMBER}git:${branch}${C.RESET}` : '';
  const isTx = isTermux();
  const envBadge = isTx ? 'Termux ARM64' : 'Mobile CLI';

  const qPct = quotaInfo.dailyPercent.toFixed(0);
  const gauge = quotaGauge(quotaInfo.dailyPercent, 6);
  const provider = (config.provider || 'custom').toUpperCase();
  const model = config.model || 'unset';
  const hasKey = config.apiKeys && config.apiKeys[config.provider];
  const keyStatus = hasKey
    ? `${C.GREEN}connected${C.RESET}`
    : `${C.AMBER}no key (/key:set)${C.RESET}`;

  const cwd = process.cwd();
  const shortCwd = cwd.length > 24 ? '...' + cwd.slice(-21) : cwd;

  return [
    '',
    `  ${C.BOLD}${C.GREEN}K A R E N O${C.RESET}  ${C.SLATE}v1.0.0 · ${envBadge}${C.RESET}`,
    `  ${C.MUTED}Autonomous Terminal Agent · BYOM & Quota Engine${C.RESET}`,
    '',
    `  ${C.SLATE}Engine${C.RESET}    ${C.WHITE}${model}${C.RESET} ${C.SLATE}(${provider})${C.RESET} ${keyStatus}`,
    `  ${C.SLATE}Quota${C.RESET}     ${gauge} ${C.WHITE}${qPct}%${C.RESET} ${C.SLATE}($${quotaInfo.dailyCost.toFixed(4)} / $${quotaInfo.dailyBudgetUsd.toFixed(2)})${C.RESET}`,
    `  ${C.SLATE}Context${C.RESET}   ${C.WHITE}${shortCwd}${C.RESET} ${branchTag} ${C.SLATE}· ${skillCount} skills${C.RESET}`,
    `  ${rule}`,
    `  ${C.MUTED}Type a task or ${C.CYAN}/help${C.MUTED} for 100 commands · ${C.CYAN}/model${C.MUTED} · ${C.CYAN}/quota${C.RESET}`,
    ''
  ].join('\n');
}

function promptLine(config, quotaInfo) {
  const model = (config.model || 'unset').split('/').pop();
  const qPct = quotaInfo.dailyPercent.toFixed(0);
  return `\n${C.SLATE}kareno${C.RESET} ${C.DARK}[${C.CYAN}${model}${C.DARK}·${C.MUTED}${qPct}%${C.DARK}]${C.RESET} ${C.GREEN}▸${C.RESET} `;
}

function spineBlock(title, rows, accent = C.GREEN) {
  const cols = getCols();
  const ruleLen = Math.max(12, Math.min(cols, 56) - title.length - 6);
  const header = `  ${C.DARK}──${C.RESET} ${C.BOLD}${C.WHITE}${title}${C.RESET} ${C.DARK}${'─'.repeat(Math.max(4, ruleLen))}${C.RESET}`;
  const out = ['', header];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (Array.isArray(row)) {
      const [k, v] = row;
      if (v === undefined) {
        out.push(`  ${C.WHITE}${k}${C.RESET}`);
      } else {
        const keyFormatted = `${C.MUTED}${String(k).padEnd(18)}${C.RESET}`;
        out.push(`  ${keyFormatted} ${C.WHITE}${v}${C.RESET}`);
      }
    } else {
      out.push(`  ${C.WHITE}${row}${C.RESET}`);
    }
  }

  out.push(`  ${C.DARK}${'─'.repeat(Math.min(cols, 56))}${C.RESET}`);
  return out.join('\n');
}

function toolStep(toolName, target, status = 'RUN', detail = '') {
  let icon = `${C.CYAN}●${C.RESET}`;
  if (status === 'OK') icon = `${C.GREEN}✔${C.RESET}`;
  if (status === 'WARN') icon = `${C.AMBER}▲${C.RESET}`;
  if (status === 'ERR') icon = `${C.RED}✖${C.RESET}`;

  const detailPart = detail ? ` ${C.SLATE}(${detail})${C.RESET}` : '';
  return `  ${icon} ${C.MUTED}${toolName}${C.RESET} ${C.WHITE}${target}${C.RESET}${detailPart}`;
}

function createSpinner(initialLabel = 'Thinking...') {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let idx = 0;
  let timer = null;
  let currentLabel = initialLabel;
  const startTime = Date.now();

  function render() {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const frame = frames[idx % frames.length];
    const text = `  ${C.GREEN}${frame}${C.RESET} ${C.MUTED}${currentLabel}${C.RESET} ${C.SLATE}${elapsed}s${C.RESET}`;
    try {
      process.stdout.write(`\r\x1b[K${text}`);
    } catch (_) {}
    idx++;
  }

  return {
    start(label) {
      if (label) currentLabel = label;
      if (!timer) {
        timer = setInterval(render, 80);
      }
    },
    setLabel(label) {
      currentLabel = label;
    },
    stop(finalMessage = '') {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      try {
        process.stdout.write('\r\x1b[K');
        if (finalMessage) {
          console.log(finalMessage);
        }
      } catch (_) {}
    }
  };
}

function formatMarkdown(content) {
  if (!content) return '';
  const lines = content.split('\n');
  const formatted = [];
  let inCodeBlock = false;
  let codeLang = '';

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        formatted.push(`  ${C.DARK}┌─ ${C.CYAN}${codeLang || 'code'}${C.RESET}`);
      } else {
        inCodeBlock = false;
        formatted.push(`  ${C.DARK}└───────────────────────${C.RESET}`);
      }
      continue;
    }

    if (inCodeBlock) {
      formatted.push(`  ${C.DARK}│${C.RESET} ${C.WHITE}${line}${C.RESET}`);
      continue;
    }

    if (line.startsWith('# ')) {
      formatted.push(`\n  ${C.BOLD}${C.GREEN}${line.slice(2).trim()}${C.RESET}\n`);
    } else if (line.startsWith('## ')) {
      formatted.push(`\n  ${C.BOLD}${C.WHITE}${line.slice(3).trim()}${C.RESET}`);
    } else if (line.startsWith('### ')) {
      formatted.push(`  ${C.AMBER}${line.slice(4).trim()}${C.RESET}`);
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const indent = line.match(/^\s*/)[0];
      const bullet = line.trim().slice(2);
      formatted.push(`${indent}  ${C.GREEN}•${C.RESET} ${colorizeInline(bullet)}`);
    } else if (/^\d+\.\s/.test(line.trim())) {
      const num = line.trim().split('.')[0];
      const rest = line.trim().replace(/^\d+\.\s*/, '');
      formatted.push(`  ${C.CYAN}${num}.${C.RESET} ${colorizeInline(rest)}`);
    } else if (!line.trim()) {
      formatted.push('');
    } else {
      formatted.push(`  ${colorizeInline(line)}`);
    }
  }

  return formatted.join('\n');
}

function colorizeInline(text) {
  return text
    .replace(/`([^`]+)`/g, `${C.CYAN}$1${C.RESET}`)
    .replace(/\*\*([^*]+)\*\*/g, `${C.BOLD}${C.WHITE}$1${C.RESET}`);
}

function renderDiff(filePath, oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const out = [];
  out.push(`  ${C.DARK}── Diff // ${filePath} ──${C.RESET}`);

  const maxLines = Math.max(oldLines.length, newLines.length);
  let shown = 0;
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o !== n) {
      if (o !== undefined) {
        out.push(`  ${C.RED}- ${String(i + 1).padStart(3)} │ ${o.slice(0, 52)}${C.RESET}`);
      }
      if (n !== undefined) {
        out.push(`  ${C.GREEN}+ ${String(i + 1).padStart(3)} │ ${n.slice(0, 52)}${C.RESET}`);
      }
      shown++;
      if (shown >= 16) {
        out.push(`  ${C.SLATE}... (diff truncated for mobile)${C.RESET}`);
        break;
      }
    }
  }
  if (shown === 0) {
    out.push(`  ${C.SLATE}(No line changes)${C.RESET}`);
  }
  return out.join('\n');
}

function info(msg) {
  console.log(`  ${C.GREEN}•${C.RESET} ${C.WHITE}${msg}${C.RESET}`);
}

function warn(msg) {
  console.log(`  ${C.AMBER}▲${C.RESET} ${C.AMBER}${msg}${C.RESET}`);
}

function error(msg) {
  console.log(`  ${C.RED}✖${C.RESET} ${C.RED}${msg}${C.RESET}`);
}

module.exports = {
  C,
  getCols,
  isTermux,
  vibrateMobile,
  toastMobile,
  quotaGauge,
  headerBanner: cleanBanner,
  promptLine,
  spineBlock,
  toolStep,
  createSpinner,
  formatMarkdown,
  renderDiff,
  info,
  warn,
  error
};
