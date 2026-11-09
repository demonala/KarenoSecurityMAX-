'use strict';

const os = require('os');
const { execSync } = require('child_process');

const C = {
  GREEN: '\x1b[38;2;0;255;115m',
  AMBER: '\x1b[38;2;255;192;0m',
  RED: '\x1b[38;2;255;42;84m',
  CYAN: '\x1b[38;2;0;210;255m',
  SLATE: '\x1b[38;2;115;140;130m',
  DARK: '\x1b[38;2;40;55;48m',
  WHITE: '\x1b[38;2;240;248;242m',
  BG_DARK: '\x1b[48;2;8;12;10m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RESET: '\x1b[0m'
};

function getCols() {
  return process.stdout.columns || 60;
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

function vibrateMobile(ms = 60) {
  try {
    execSync(`termux-vibrate -d ${ms}`, { stdio: 'ignore', timeout: 500 });
  } catch (_) {}
}

function toastMobile(message) {
  try {
    execSync(`termux-toast "${message.replace(/"/g, '\\"')}"`, { stdio: 'ignore', timeout: 800 });
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
      timeout: 1000,
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    if (b) {
      const dirty = execSync('git status --porcelain', {
        encoding: 'utf8',
        timeout: 1000,
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim() ? '*' : '';
      return `${b}${dirty}`;
    }
  } catch (_) {}
  return '';
}

function mobileBanner(config, quotaInfo, skillCount) {
  const cols = getCols();
  const width = Math.min(cols, 68);
  const bar = '━'.repeat(Math.max(10, width - 4));
  const branch = getGitBranch();
  const branchTag = branch ? `${C.SLATE}·${C.RESET} ${C.AMBER}git:${branch}${C.RESET} ` : '';
  const isTx = isTermux();
  const envBadge = isTx ? `${C.GREEN}TERMUX MOBILE${C.RESET}` : `${C.CYAN}MOBILE CLI${C.RESET}`;

  const qPct = quotaInfo.dailyPercent.toFixed(0);
  const gauge = quotaGauge(quotaInfo.dailyPercent, 6);
  const provider = (config.provider || 'custom').toUpperCase();
  const model = config.model || 'unset';
  const keyStatus = config.apiKeys && config.apiKeys[config.provider]
    ? `${C.GREEN}CONNECTED${C.RESET}`
    : `${C.AMBER}NO KEY (/key:set)${C.RESET}`;

  const cwd = process.cwd();
  const shortCwd = cwd.length > 28 ? '...' + cwd.slice(-25) : cwd;

  return [
    '',
    `${C.GREEN}  ┏━⟦ ${C.BOLD}${C.WHITE}KARENO${C.RESET} ${C.GREEN}⟧${C.DARK}${bar.slice(12)}┓${C.RESET}`,
    `${C.GREEN}  ┃${C.RESET} ${C.BOLD}${C.WHITE}TACTICAL AUTONOMOUS CODE ENGINE${C.RESET} ${C.SLATE}// v1.0.0${C.RESET}`,
    `${C.GREEN}  ┃${C.RESET} ${envBadge} ${C.SLATE}·${C.RESET} ${C.WHITE}100 COMMANDS${C.RESET} ${C.SLATE}·${C.RESET} ${C.CYAN}${skillCount} SKILLS${C.RESET}`,
    `${C.GREEN}  ┣━⟦ ${C.BOLD}${C.WHITE}MODEL${C.RESET} ${C.GREEN}⟧${C.RESET} ${C.CYAN}${provider}${C.RESET}/${C.WHITE}${model}${C.RESET} ${C.SLATE}[${keyStatus}${C.SLATE}]${C.RESET}`,
    `${C.GREEN}  ┣━⟦ ${C.BOLD}${C.WHITE}QUOTA${C.RESET} ${C.GREEN}⟧${C.RESET} ${gauge} ${C.WHITE}${qPct}%${C.RESET} ${C.SLATE}($${quotaInfo.dailyCost.toFixed(4)} / $${quotaInfo.dailyBudgetUsd.toFixed(2)})${C.RESET}`,
    `${C.GREEN}  ┗━⟦ ${C.BOLD}${C.WHITE}PATH ${C.RESET} ${C.GREEN}⟧${C.RESET} ${C.WHITE}${shortCwd}${C.RESET} ${branchTag}`,
    `  ${C.DARK}${bar}${C.RESET}`,
    `  ${C.SLATE}Enter task or type ${C.CYAN}/help${C.SLATE} · ${C.CYAN}/model${C.SLATE} · ${C.CYAN}/quota${C.SLATE} · ${C.CYAN}/skills${C.RESET}`,
    ''
  ].join('\n');
}

function promptLine(config, quotaInfo) {
  const provider = (config.provider || 'none').toUpperCase();
  const model = (config.model || 'unset').split('/').pop();
  const qPct = quotaInfo.dailyPercent.toFixed(0);
  const gauge = quotaGauge(quotaInfo.dailyPercent, 5);
  const cwd = process.cwd().split(/[\\/]/).pop() || '~';
  const branch = getGitBranch();
  const branchPart = branch ? `━⟦${C.AMBER}${branch}${C.GREEN}⟧` : '';

  return (
    `\n${C.GREEN}┏━⟦${C.RESET}${C.BOLD}${C.WHITE}KARENO${C.RESET}${C.GREEN}⟧━⟦${C.RESET}${C.CYAN}${provider}:${model}${C.RESET}${C.GREEN}⟧━⟦${C.RESET}${gauge} ${C.WHITE}${qPct}%${C.RESET}${C.GREEN}⟧━⟦${C.RESET}${C.SLATE}${cwd}${C.RESET}${C.GREEN}⟧${branchPart}${C.RESET}\n` +
    `${C.GREEN}┗━━▸${C.RESET} `
  );
}

function spineBlock(title, rows, accent = C.GREEN) {
  const out = [];
  const cols = getCols();
  const maxKeyLen = Math.min(22, Math.floor(cols * 0.35));
  out.push(`${accent}┏━⟦ ${C.BOLD}${C.WHITE}${title}${C.RESET}${accent} ⟧${C.RESET}`);

  for (let i = 0; i < rows.length; i++) {
    const isLast = i === rows.length - 1;
    const joint = isLast ? '┗━━▸' : '╟──▸';
    const row = rows[i];
    if (Array.isArray(row)) {
      const [k, v] = row;
      if (v === undefined) {
        out.push(`${accent}${joint}${C.RESET} ${C.WHITE}${k}${C.RESET}`);
      } else {
        const keyPadded = String(k).padEnd(maxKeyLen);
        out.push(`${accent}${joint}${C.RESET} ${C.SLATE}${keyPadded}${C.RESET} ${C.WHITE}${v}${C.RESET}`);
      }
    } else {
      out.push(`${accent}${joint}${C.RESET} ${C.WHITE}${row}${C.RESET}`);
    }
  }
  return out.join('\n');
}

function toolStep(toolName, target, status = 'RUN', detail = '') {
  let icon = `${C.CYAN}●${C.RESET}`;
  if (status === 'OK') icon = `${C.GREEN}✔${C.RESET}`;
  if (status === 'WARN') icon = `${C.AMBER}▲${C.RESET}`;
  if (status === 'ERR') icon = `${C.RED}✖${C.RESET}`;

  const detailPart = detail ? ` ${C.SLATE}(${detail})${C.RESET}` : '';
  return `  ${icon} ${C.BOLD}${C.WHITE}${toolName}${C.RESET} ${C.CYAN}${target}${C.RESET}${detailPart}`;
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
    const text = `  ${C.GREEN}${frame}${C.RESET} ${C.WHITE}${currentLabel}${C.RESET} ${C.SLATE}(${elapsed}s)${C.RESET}`;
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
        formatted.push(`${C.DARK}┏━⟦ ${C.CYAN}${codeLang || 'CODE'}${C.RESET}${C.DARK} ⟧${'━'.repeat(24)}┓${C.RESET}`);
      } else {
        inCodeBlock = false;
        formatted.push(`${C.DARK}┗${'━'.repeat(34)}┛${C.RESET}`);
      }
      continue;
    }

    if (inCodeBlock) {
      formatted.push(`${C.DARK}┃${C.RESET} ${C.WHITE}${line}${C.RESET}`);
      continue;
    }

    if (line.startsWith('# ')) {
      formatted.push(`\n${C.GREEN}┏━⟦ ${C.BOLD}${C.WHITE}${line.slice(2).trim()}${C.RESET}${C.GREEN} ⟧${C.RESET}`);
    } else if (line.startsWith('## ')) {
      formatted.push(`\n${C.CYAN}╟──▸ ${C.BOLD}${C.WHITE}${line.slice(3).trim()}${C.RESET}`);
    } else if (line.startsWith('### ')) {
      formatted.push(`\n${C.AMBER}▸ ${C.BOLD}${C.WHITE}${line.slice(4).trim()}${C.RESET}`);
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const indent = line.match(/^\s*/)[0];
      const bullet = line.trim().slice(2);
      formatted.push(`${indent}  ${C.GREEN}▸${C.RESET} ${colorizeInline(bullet)}`);
    } else if (/^\d+\.\s/.test(line.trim())) {
      formatted.push(`  ${C.CYAN}${line.trim().split('.')[0]}.${C.RESET} ${colorizeInline(line.trim().replace(/^\d+\.\s*/, ''))}`);
    } else {
      formatted.push(colorizeInline(line));
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
  out.push(`${C.CYAN}┏━⟦ DIFF // ${filePath} ⟧${C.RESET}`);

  const maxLines = Math.max(oldLines.length, newLines.length);
  let shown = 0;
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o !== n) {
      if (o !== undefined) {
        out.push(`${C.RED}┃ - ${String(i + 1).padStart(3)} │ ${o.slice(0, 56)}${C.RESET}`);
      }
      if (n !== undefined) {
        out.push(`${C.GREEN}┃ + ${String(i + 1).padStart(3)} │ ${n.slice(0, 56)}${C.RESET}`);
      }
      shown++;
      if (shown >= 18) {
        out.push(`${C.SLATE}┃ ... (diff truncated for mobile)${C.RESET}`);
        break;
      }
    }
  }
  if (shown === 0) {
    out.push(`${C.SLATE}┃ (No line differences)${C.RESET}`);
  }
  out.push(`${C.CYAN}┗━━▸ END DIFF${C.RESET}`);
  return out.join('\n');
}

function info(msg) {
  console.log(`${C.GREEN}╟──▸${C.RESET} ${C.WHITE}${msg}${C.RESET}`);
}

function warn(msg) {
  console.log(`${C.AMBER}╟─[!]▸${C.RESET} ${C.AMBER}${msg}${C.RESET}`);
}

function error(msg) {
  console.log(`${C.RED}╟─[ERR]▸${C.RESET} ${C.RED}${msg}${C.RESET}`);
}

module.exports = {
  C,
  getCols,
  isTermux,
  vibrateMobile,
  toastMobile,
  quotaGauge,
  headerBanner: mobileBanner,
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
