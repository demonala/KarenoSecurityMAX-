'use strict';

const os = require('os');
const { execSync } = require('child_process');

const C = {
  CYAN: '\x1b[38;2;6;182;212m',      // Electric Cyan #06b6d4
  GREEN: '\x1b[38;2;16;185;129m',    // Modern Emerald #10b981
  AMBER: '\x1b[38;2;245;158;11m',    // Warm Amber #f59e0b
  RED: '\x1b[38;2;239;68;68m',       // Rose Red #ef4444
  SLATE: '\x1b[38;2;100;116;139m',   // Muted Slate #64748b
  DARK: '\x1b[38;2;51;65;85m',       // Clean Border #334155
  WHITE: '\x1b[38;2;241;245;249m',   // Crisp White #f1f5f9
  MUTED: '\x1b[38;2;148;163;184m',   // Secondary Text #94a3b8
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RESET: '\x1b[0m'
};

const OPENCODE_LOGO = [
  " _                                ",
  "| | ____ _ _ __ ___ _ __   ___    ",
  "| |/ / _` | '__/ _ \\ '_ \\ / _ \\   ",
  "|   < (_| | | |  __/ | | | (_) |  ",
  "|_|\\_\\__,_|_|  \\___|_| |_|\\___/   "
];

function stripAnsi(str) {
  return String(str || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function getCols() {
  const c = process.stdout.columns || 60;
  return Math.max(38, Math.min(c, 76));
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

function headerBanner(config, quotaInfo, skillCount) {
  const cols = getCols();
  const boxWidth = Math.min(cols, 56);
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
  const shortCwd = cwd.length > 22 ? '...' + cwd.slice(-19) : cwd;

  const rows = [
    ['Engine', `${model} (${provider})`, keyStatus],
    ['Quota', `${gauge} ${qPct}% ($${quotaInfo.dailyCost.toFixed(4)} / $${quotaInfo.dailyBudgetUsd.toFixed(2)})`],
    ['Context', `${shortCwd} ${branchTag}`, `${skillCount} skills`]
  ];

  const logoColored = OPENCODE_LOGO.map(l => `  ${C.CYAN}${l}${C.RESET}`).join('\n');
  const box = spineBlock(`kareno v1.0.0 · ${envBadge}`, rows, C.CYAN, boxWidth);

  return [
    '',
    logoColored,
    box,
    `  ${C.MUTED}Type a task, or ${C.CYAN}/${C.MUTED} for 100 commands (/help, /model, /quota)${C.RESET}`,
    ''
  ].join('\n');
}

function promptLine(config, quotaInfo) {
  return `${C.SLATE}kareno${C.RESET} ${C.CYAN}>${C.RESET} `;
}

function spineBlock(title, rows, accent = C.CYAN, customWidth = 0) {
  const cols = getCols();
  const targetWidth = customWidth > 0 ? customWidth : Math.min(cols, 64);
  const titleClean = stripAnsi(title);
  const topBarLen = Math.max(2, targetWidth - titleClean.length - 6);
  const out = [];

  out.push(`  ${C.DARK}┌─${C.RESET} ${C.BOLD}${C.WHITE}${title}${C.RESET} ${C.DARK}${'─'.repeat(topBarLen)}┐${C.RESET}`);
  const contentWidth = targetWidth - 4; // internal spacing between │ and │

  // Find optimal key padding based on actual keys in this block
  let maxKeyLen = 8;
  for (const r of rows) {
    if (Array.isArray(r) && r[0]) {
      maxKeyLen = Math.max(maxKeyLen, stripAnsi(r[0]).length + 2);
    }
  }
  maxKeyLen = Math.min(maxKeyLen, 13);

  for (const row of rows) {
    let lineContent = '';
    if (Array.isArray(row)) {
      if (row.length === 3) {
        // [Key, Val, RightTag]
        const [k, v, tag] = row;
        const keyPadded = String(k).padEnd(9);
        const leftPart = `${C.SLATE}${keyPadded}${C.RESET} ${C.WHITE}${v}${C.RESET}`;
        const rightPart = String(tag);
        const usedLen = stripAnsi(leftPart).length + stripAnsi(rightPart).length;
        const padLen = Math.max(1, contentWidth - usedLen);
        lineContent = `${leftPart}${' '.repeat(padLen)}${rightPart}`;
      } else {
        const [k, v] = row;
        if (v === undefined) {
          lineContent = `${C.WHITE}${k}${C.RESET}`;
        } else {
          let keyStr = String(k);
          let keyPadded = keyStr.length < maxKeyLen ? keyStr.padEnd(maxKeyLen) : keyStr + ' ';
          let valStr = String(v);
          const currentTotal = stripAnsi(keyPadded).length + stripAnsi(valStr).length;
          if (currentTotal > contentWidth) {
            const allowed = Math.max(8, contentWidth - stripAnsi(keyPadded).length - 3);
            valStr = valStr.slice(0, allowed) + '..';
          }
          lineContent = `${C.SLATE}${keyPadded}${C.RESET}${C.WHITE}${valStr}${C.RESET}`;
        }
      }
    } else {
      let str = String(row);
      if (stripAnsi(str).length > contentWidth) {
        str = str.slice(0, contentWidth - 2) + '..';
      }
      lineContent = `${C.WHITE}${str}${C.RESET}`;
    }

    const visibleLen = stripAnsi(lineContent).length;
    const rightPad = Math.max(0, contentWidth - visibleLen);
    out.push(`  ${C.DARK}│${C.RESET} ${lineContent}${' '.repeat(rightPad)} ${C.DARK}│${C.RESET}`);
  }

  out.push(`  ${C.DARK}└${'─'.repeat(targetWidth - 2)}┘${C.RESET}`);
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
    const text = `  ${C.CYAN}${frame}${C.RESET} ${C.MUTED}${currentLabel}${C.RESET} ${C.SLATE}${elapsed}s${C.RESET}`;
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
  headerBanner,
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
