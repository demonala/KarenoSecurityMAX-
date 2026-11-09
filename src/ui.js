'use strict';

const os = require('os');

const C = {
  GREEN: '\x1b[38;2;0;255;115m',
  AMBER: '\x1b[38;2;255;192;0m',
  RED: '\x1b[38;2;255;42;84m',
  CYAN: '\x1b[38;2;0;210;255m',
  SLATE: '\x1b[38;2;110;130;120m',
  DARK: '\x1b[38;2;45;60;52m',
  WHITE: '\x1b[38;2;235;245;238m',
  BG_DARK: '\x1b[48;2;10;15;12m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RESET: '\x1b[0m'
};

function getWidth() {
  const cols = process.stdout.columns || 76;
  return Math.max(56, Math.min(cols - 2, 88));
}

function isTermux() {
  return Boolean(
    process.env.TERMUX_VERSION ||
    (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) ||
    os.release().toLowerCase().includes('android')
  );
}

function quotaGauge(percent, size = 8) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((clamped / 100) * size);
  const empty = Math.max(0, size - filled);
  const color = clamped >= 85 ? C.RED : clamped >= 60 ? C.AMBER : C.GREEN;
  return `${color}${'▰'.repeat(filled)}${C.DARK}${'▱'.repeat(empty)}${C.RESET}`;
}

function headerBanner(config, quotaInfo, skillCount) {
  const w = getWidth();
  const envTag = isTermux() ? 'TERMUX/ARM' : `${os.platform().toUpperCase()}/${os.arch()}`;
  const modelTag = config.model || 'UNSET (run /model:set)';
  const providerTag = (config.provider || 'custom').toUpperCase();
  const qPct = quotaInfo.dailyPercent.toFixed(1);
  const gauge = quotaGauge(quotaInfo.dailyPercent, 8);
  const keyState = config.apiKeys && config.apiKeys[config.provider]
    ? `${C.GREEN}AUTHENTICATED${C.RESET}`
    : `${C.AMBER}NO KEY (/key:set)${C.RESET}`;

  const rule = `${C.DARK}${'━'.repeat(Math.max(10, w - 2))}${C.RESET}`;

  return [
    '',
    `${C.GREEN}  ██╗  ██╗ █████╗ ██████╗ ███████╗███╗   ██╗ ██████╗ ${C.RESET}`,
    `${C.GREEN}  ██║ ██╔╝██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔═══██╗${C.RESET}`,
    `${C.GREEN}  █████╔╝ ███████║██████╔╝█████╗  ██╔██╗ ██║██║   ██║${C.RESET}`,
    `${C.GREEN}  ██╔═██╗ ██╔══██║██╔══██╗██╔══╝  ██║╚██╗██║██║   ██║${C.RESET}`,
    `${C.GREEN}  ██║  ██╗██║  ██║██║  ██║███████╗██║ ╚████║╚██████╔╝${C.RESET}`,
    `${C.SLATE}  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ${C.WHITE}v1.0.0${C.RESET}`,
    `  ${C.SLATE}TACTICAL CODE ENGINE · ABSOLUTE IMMORTAL INC. · BYOM ARCHITECTURE${C.RESET}`,
    `  ${rule}`,
    `  ${C.GREEN}┏━⟦${C.RESET} ${C.BOLD}${C.WHITE}RUNTIME${C.RESET} ${C.GREEN}⟧${C.RESET} ${C.WHITE}${envTag}${C.RESET} ${C.SLATE}·${C.RESET} ${C.CYAN}100 COMMANDS${C.RESET} ${C.SLATE}·${C.RESET} ${C.WHITE}${skillCount} SKILLS ACTIVE${C.RESET}`,
    `  ${C.GREEN}┣━⟦${C.RESET} ${C.BOLD}${C.WHITE}ENGINE ${C.RESET} ${C.GREEN}⟧${C.RESET} ${C.CYAN}${providerTag}${C.RESET} ${C.SLATE}/${C.RESET} ${C.WHITE}${modelTag}${C.RESET} ${C.SLATE}[${keyState}${C.SLATE}]${C.RESET}`,
    `  ${C.GREEN}┗━⟦${C.RESET} ${C.BOLD}${C.WHITE}QUOTA  ${C.RESET} ${C.GREEN}⟧${C.RESET} ${gauge} ${C.WHITE}${qPct}%${C.RESET} ${C.SLATE}(${quotaInfo.dailyTokens.toLocaleString()}/${quotaInfo.dailyTokenLimit.toLocaleString()} tok · $${quotaInfo.dailyCost.toFixed(4)}/$${quotaInfo.dailyBudgetUsd.toFixed(2)})${C.RESET}`,
    `  ${rule}`,
    `  ${C.SLATE}Type ${C.CYAN}/help${C.SLATE} for 100 commands, ${C.CYAN}/key:set <key>${C.SLATE} to connect your model, or enter a task.${C.RESET}`,
    ''
  ].join('\n');
}

function promptLine(config, quotaInfo) {
  const provider = (config.provider || 'none').toUpperCase();
  const model = config.model || 'unset';
  const qPct = quotaInfo.dailyPercent.toFixed(0);
  const gauge = quotaGauge(quotaInfo.dailyPercent, 5);
  const cwd = process.cwd().split(/[\\/]/).pop() || '/';
  return (
    `\n${C.GREEN}┏━⟦${C.RESET}${C.BOLD}${C.WHITE}KARENO${C.RESET}${C.GREEN}⟧━⟦${C.RESET}${C.CYAN}${provider}:${model}${C.RESET}${C.GREEN}⟧━⟦${C.RESET}${gauge} ${C.WHITE}${qPct}%${C.RESET} ${C.SLATE}$${quotaInfo.sessionCost.toFixed(4)}${C.GREEN}⟧━⟦${C.RESET}${C.AMBER}${cwd}${C.RESET}${C.GREEN}⟧${C.RESET}\n` +
    `${C.GREEN}┗━━▸${C.RESET} `
  );
}

function spineBlock(title, rows, accent = C.GREEN) {
  const out = [];
  out.push(`${accent}┏━⟦ ${C.BOLD}${C.WHITE}${title}${C.RESET}${accent} ⟧${C.RESET}`);
  for (let i = 0; i < rows.length; i++) {
    const isLast = i === rows.length - 1;
    const joint = isLast ? '┗━━▸' : '╟──▸';
    const [k, v] = rows[i];
    if (v === undefined) {
      out.push(`${accent}${joint}${C.RESET} ${C.WHITE}${k}${C.RESET}`);
    } else {
      out.push(`${accent}${joint}${C.RESET} ${C.SLATE}${String(k).padEnd(20)}${C.RESET} ${C.WHITE}${v}${C.RESET}`);
    }
  }
  return out.join('\n');
}

function toolTrace(toolName, target, detail, status = 'OK') {
  const col = status === 'OK' ? C.GREEN : status === 'WARN' ? C.AMBER : C.RED;
  return `${col}╟─[TOOL:${toolName.toUpperCase()}]─▸${C.RESET} ${C.WHITE}${target}${C.RESET} ${C.SLATE}(${detail})${C.RESET}`;
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
        out.push(`${C.RED}┃ - ${String(i + 1).padStart(4)} │ ${o}${C.RESET}`);
      }
      if (n !== undefined) {
        out.push(`${C.GREEN}┃ + ${String(i + 1).padStart(4)} │ ${n}${C.RESET}`);
      }
      shown++;
      if (shown >= 24) {
        out.push(`${C.SLATE}┃ ... (diff truncated for terminal width)${C.RESET}`);
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
  getWidth,
  isTermux,
  quotaGauge,
  headerBanner,
  promptLine,
  spineBlock,
  toolTrace,
  renderDiff,
  info,
  warn,
  error
};
