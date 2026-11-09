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

function buildSystemPrompt(config, skills) {
  const parts = [
    'You are KARENO, an autonomous terminal-native software engineering agent built for Termux and desktop CLI environments.',
    `Current working directory: ${process.cwd()}`,
    `Operating system: ${process.platform} (${process.arch})`,
    '',
    'CORE OPERATING DIRECTIVES:',
    '1. Be concise, direct, and technical. Avoid filler, emojis, and generic disclaimers.',
    '2. Use tools (read_file, write_file, edit_file, list_dir, grep_code, run_command) to inspect the codebase and verify changes rather than guessing.',
    '3. Before editing a file, read the relevant lines first so your target block matches exact whitespace.',
    '4. Conserve token quota by reading targeted line ranges when working with large files.'
  ];

  // Load workspace KARENO.md if present
  const karenoMd = path.join(process.cwd(), 'KARENO.md');
  if (fs.existsSync(karenoMd)) {
    try {
      const content = fs.readFileSync(karenoMd, 'utf8').slice(0, 8000);
      parts.push(`\n# WORKSPACE BRIEF (KARENO.md)\n${content}`);
    } catch (_) {}
  }

  // Load persistent memory notes
  if (config.memoryNotes && config.memoryNotes.length > 0) {
    parts.push(
      `\n# PERSISTENT USER MEMORIES\n` +
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
          const snippet = fs.readFileSync(full, 'utf8').slice(0, 6000);
          pinnedBlocks.push(`--- PINNED FILE: ${relPath} ---\n${snippet}`);
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

    const maxTurns = 10;
    for (let turn = 0; turn < maxTurns; turn++) {
      const turnGate = quota.checkGate();
      if (!turnGate.allowed) {
        UI.error(`QUOTA GATE BLOCKED MID-RUN: ${turnGate.reason}`);
        break;
      }

      process.stdout.write(`${C.GREEN}╟─[KARENO:${config.provider.toUpperCase()}]─▸${C.RESET} ${C.SLATE}reasoning...${C.RESET}\r`);
      let res;
      try {
        res = await callModel(config, systemPrompt, messages, true);
      } catch (err) {
        process.stdout.write(' '.repeat(60) + '\r');
        UI.error(`Model API Error: ${err.message}`);
        break;
      }
      process.stdout.write(' '.repeat(60) + '\r');

      const inTok = res.inputTokens || quota.estimateTokens(systemPrompt + JSON.stringify(messages));
      const outTok = res.outputTokens || quota.estimateTokens(res.content);
      const usage = quota.recordUsage(config.provider, inTok, outTok);

      if (res.content && res.content.trim()) {
        console.log(
          `\n${C.GREEN}┏━⟦ ${C.BOLD}${C.WHITE}KARENO RESPONSE${C.RESET}${C.GREEN} ⟧━⟦ ${C.SLATE}+${usage.inputTokens + usage.outputTokens} tok · $${usage.costUsd.toFixed(5)}${C.GREEN} ⟧${C.RESET}`
        );
        const lines = res.content.trim().split('\n');
        for (const line of lines) {
          console.log(`${C.GREEN}┃${C.RESET} ${C.WHITE}${line}${C.RESET}`);
        }
        console.log(`${C.GREEN}┗━━▸ END${C.RESET}`);
      }

      if (!res.toolCalls || res.toolCalls.length === 0) {
        messages.push({ role: 'assistant', content: res.content || '' });
        break;
      }

      messages.push({
        role: 'assistant',
        content: res.content || '',
        tool_calls: res.toolCalls
      });

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
          content: String(toolOutput).slice(0, 12000)
        });
      }
    }
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
        UI.warn(`Unknown command "${trimmed.split(/\s+/)[0]}". Type /help or /commands to list all 100 commands.`);
      }
      return;
    }

    await runAgentPrompt(trimmed);
  }

  function startRepl() {
    const activeSkillsCount = skills.listAll().filter(s => s.enabled).length;
    console.log(UI.headerBanner(config, quota.getSummary(), activeSkillsCount));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line) => {
        const hits = COMMAND_CATALOG.map(c => c.cmd).filter(c => c.startsWith(line));
        return [hits.length ? hits : [], line];
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
