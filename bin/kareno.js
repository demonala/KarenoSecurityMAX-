#!/usr/bin/env node
'use strict';

const { createAgentRuntime } = require('../src/agent');
const UI = require('../src/ui');

async function main() {
  const args = process.argv.slice(2);
  const runtime = createAgentRuntime();

  if (args.includes('--version') || args.includes('-v')) {
    console.log('kareno-cli v1.0.0 (Node.js ' + process.version + ')');
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    const activeSkillsCount = runtime.skills.listAll().filter(s => s.enabled).length;
    console.log(UI.headerBanner(runtime.config, runtime.quota.getSummary(), activeSkillsCount));
    console.log(UI.spineBlock('CLI LAUNCH OPTIONS', [
      ['kareno', 'Start interactive Kareno tactical REPL'],
      ['kareno --cmd "/command"', 'Execute any of the 100 slash commands non-interactively'],
      ['kareno --prompt "task"', 'Run an autonomous coding task and exit'],
      ['kareno --version', 'Print version & Node.js runtime info']
    ]));
    process.exit(0);
  }

  const cmdIdx = args.indexOf('--cmd');
  if (cmdIdx !== -1 && args[cmdIdx + 1]) {
    await runtime.processInput(args[cmdIdx + 1]);
    process.exit(0);
  }

  const promptIdx = args.indexOf('--prompt');
  if (promptIdx !== -1 && args[promptIdx + 1]) {
    await runtime.processInput(args.slice(promptIdx + 1).join(' '));
    process.exit(0);
  }

  // If user passed a direct slash command or task without flags
  if (args.length > 0) {
    await runtime.processInput(args.join(' '));
    process.exit(0);
  }

  runtime.startRepl();
}

main().catch((err) => {
  UI.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
