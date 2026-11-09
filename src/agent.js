'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const UI = require('./ui');
const { loadConfig } = require('./config');
const { QuotaManager } = require('./quota');
const { SkillManager } = require('./skills');
const { executeTool, resolveWorkspacePath } = require('./tools');
const { callModel } = require('./providers');
const { COMMAND_CATALOG, handleSlashCommand } = require('./commands');
const updater = require('./updater');

function buildSystemPrompt(config, skills) {
  const parts = [
    'You are KARENO, a tactical autonomous software engineering agent built specifically for mobile Termux and terminal environments.',
    `Working Directory: ${process.cwd()}`,
    `Platform: ${process.platform} (${process.arch}) ${UI.isTermux() ? '[Android Termux]' : '[Mobile Emulation]'}`,
    '',
    'MOBILE DIRECTIVES:',
    '1. Be direct, dense, and technically precise. No fluff, no introductory chit-chat, no emojis.',
    '2. Format output for narrow mobile screens (keep code blocks clean, avoid excessively wide tables).',
    '3. Use tools (read_file, write_file, edit_file, list_dir, grep_code, run_command) to inspect and verify before making changes.',
    '4. Conserve token quota: read targeted line ranges when working with large files.'
  ];

  // Load workspace KARENO.md if present
  const karenoMd = path.join(process.cwd(), 'KARENO.md');
  if (fs.existsSync(karenoMd)) {
    try {
      const content = fs.readFileSync(karenoMd, 'utf8').slice(0, 8000);
      parts.push(`\n# WORKSPACE CONTEXT (KARENO.md)\n${content}`);
    } catch (_) {}
  }

  // Load persistent memory notes
  if (config.memoryNotes && config.memoryNotes.length > 0) {
    parts.push(
      `\n# PERSISTENT AGENT MEMORIES\n` +
      config.memoryNotes.map((m, i) => `${i + 1}. ${m}`).join('\n')
    );
  }

  // Load pinned files
  if (config.pinnedFiles && config.pinnedFiles.length > 0) {
    const pinnedBlocks = [];
    for (const relPath of config.pinnedFiles) {
      const full = resolveWorkspacePath(relPath);
      if (fs.existsSync(full)) {
        try {
          const snippet = fs.readFileSync(full, 'utf8').slice(0, 5000);
          pinnedBlocks.push(`--- PINNED: ${relPath} ---\n${snippet}`);
        } catch (_) {}
      }
    }
    if (pinnedBlocks.length > 0) {
      parts.push(`\n# PINNED CONTEXT FILES\n${pinnedBlocks.join('\n\n')}`);
    }
  }

  // Load active skills
  const skillBlock = skills.getActivePromptBlock();
  if (skillBlock) {
    parts.push(skillBlock);
  }

  return parts.join('\n');
}

function createAgentRuntime() {
  const config = loadConfig();
  const quota = new QuotaManager();
  const skills = new SkillManager(config);
  const messages = [];
  const checkpoints = new Map();
  const { C } = UI;

  async function runAgentPrompt(userPrompt) {
    const gate = quota.checkGate();
    if (!gate.allowed) {
      UI.error(`QUOTA GATE BLOCKED: ${gate.reason}`);
      return;
    }

    messages.push({ role: 'user', content: userPrompt });
    const systemPrompt = buildSystemPrompt(config, skills);

    const spinner = UI.createSpinner(`Thinking [${config.provider}:${config.model}]...`);
    spinner.start();
    const t0 = Date.now();
    let totalInTok = 0;
    let totalOutTok = 0;
    let totalCost = 0.0;

    const maxTurns = 8;
    for (let turn = 0; turn < maxTurns; turn++) {
      const turnGate = quota.checkGate();
      if (!turnGate.allowed) {
        spinner.stop();
        UI.error(`QUOTA GATE BLOCKED MID-TASK: ${turnGate.reason}`);
        break;
      }

      spinner.setLabel(`Reasoning [${config.provider}] (turn ${turn + 1}/${maxTurns})...`);
      let res;
      try {
        res = await callModel(config, systemPrompt, messages, true);
      } catch (err) {
        spinner.stop();
        UI.error(`Model API Error: ${err.message}`);
        break;
      }

      const inTok = res.inputTokens || quota.estimateTokens(systemPrompt + JSON.stringify(messages));
      const outTok = res.outputTokens || quota.estimateTokens(res.content);
      const usage = quota.recordUsage(config.provider, inTok, outTok);
      totalInTok += usage.inputTokens;
      totalOutTok += usage.outputTokens;
      totalCost += usage.costUsd;

      // If the model produced final content
      if (res.content && res.content.trim()) {
        spinner.stop();
        console.log('\n' + UI.formatMarkdown(res.content.trim()));
      }

      // If no tool calls, task is finished
      if (!res.toolCalls || res.toolCalls.length === 0) {
        messages.push({ role: 'assistant', content: res.content || '' });
        break;
      }

      // If tool calls, execute them
      messages.push({
        role: 'assistant',
        content: res.content || '',
        tool_calls: res.toolCalls
      });

      spinner.stop();
      for (const tc of res.toolCalls) {
        const fnName = tc.function ? tc.function.name : tc.name;
        let fnArgs = {};
        try {
          fnArgs = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments || '{}')
            : (tc.function?.arguments || {});
        } catch (_) {}

        const toolOutput = executeTool(fnName, fnArgs);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id || `call_${Date.now()}`,
          name: fnName,
          content: String(toolOutput).slice(0, 10000)
        });
      }

      spinner.start(`Synthesizing tool results...`);
    }

    spinner.stop();
    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
    const qInfo = quota.getSummary();
    const gauge = UI.quotaGauge(qInfo.dailyPercent, 5);

    console.log(
      `\n  ${C.DARK}─${C.RESET} ${C.SLATE}${elapsedSec}s · +${totalInTok + totalOutTok} tok ($${totalCost.toFixed(4)}) · Quota ${gauge} ${qInfo.dailyPercent.toFixed(0)}%${C.RESET}`
    );

    // Haptic feedback for mobile Termux
    UI.vibrateMobile(40);
  }

  const ctx = {
    config,
    quota,
    skills,
    messages,
    checkpoints,
    runAgentPrompt
  };

  async function processInput(line) {
    const trimmed = (line || '').trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      const res = await handleSlashCommand(trimmed, ctx);
      if (!res.handled) {
        const cmdOnly = trimmed.split(/\s+/)[0];
        const match = COMMAND_CATALOG.find(c => c.cmd.startsWith(cmdOnly.slice(0, 4)));
        const suggestion = match ? ` Did you mean ${C.CYAN}${match.cmd}${C.AMBER}?` : '';
        UI.warn(`Unknown command "${cmdOnly}".${suggestion} Type /help or /commands to list all 100 commands.`);
      }
      return;
    }

    await runAgentPrompt(trimmed);
  }

  function startRepl() {
    // Clear screen and set mobile terminal title
    try {
      process.stdout.write('\x1b[2J\x1b[H\x1b]0;KARENO // Mobile Tactical Agent\x07');
    } catch (_) {}

    const activeSkillsCount = skills.listAll().filter(s => s.enabled).length;
    console.log(UI.headerBanner(config, quota.getSummary(), activeSkillsCount));

    // Non-blocking background check for GitHub updates
    updater.checkForUpdates().then((res) => {
      if (res && res.hasUpdate) {
        console.log(`  ${UI.C.AMBER}▲ Update available: v${res.latestVersion} (${res.latestCommit || 'new'}). Run /update to upgrade.${UI.C.RESET}\n`);
      }
    }).catch(() => {});

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/')) {
          const hits = COMMAND_CATALOG.map(c => c.cmd).filter(c => c.startsWith(trimmed));
          return [hits.length ? hits : [], line];
        }
        return [[], line];
      }
    });

    const promptNext = () => {
      rl.question(UI.promptLine(config, quota.getSummary()), async (answer) => {
        try {
          await processInput(answer);
        } catch (err) {
          UI.error(`Runtime Exception: ${err.message}`);
        }
        promptNext();
      });
    };

    rl.on('close', () => {
      console.log('');
      UI.info('KARENO session terminated.');
      process.exit(0);
    });

    promptNext();
  }

  return {
    config,
    quota,
    skills,
    processInput,
    startRepl
  };
}

module.exports = {
  createAgentRuntime
};
