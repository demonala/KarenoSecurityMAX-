'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const KARENO_DIR = path.join(os.homedir(), '.kareno');
const CONFIG_FILE = path.join(KARENO_DIR, 'config.json');

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    envKey: 'DEEPSEEK_API_KEY',
    pricingPer1M: { input: 0.27, output: 1.10 }
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-7-sonnet-latest',
    models: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    envKey: 'ANTHROPIC_API_KEY',
    pricingPer1M: { input: 3.00, output: 15.00 }
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
    envKey: 'OPENAI_API_KEY',
    pricingPer1M: { input: 2.50, output: 10.00 }
  },
  groq: {
    name: 'Groq Cloud (LPU)',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'qwen-2.5-coder-32b', 'deepseek-r1-distill-llama-70b'],
    envKey: 'GROQ_API_KEY',
    pricingPer1M: { input: 0.59, output: 0.79 }
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
    envKey: 'GEMINI_API_KEY',
    pricingPer1M: { input: 0.15, output: 0.60 }
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    models: ['anthropic/claude-3.7-sonnet', 'deepseek/deepseek-chat', 'openai/gpt-4o', 'google/gemini-2.5-pro'],
    envKey: 'OPENROUTER_API_KEY',
    pricingPer1M: { input: 2.00, output: 8.00 }
  },
  ollama: {
    name: 'Local Ollama (Self-Hosted)',
    baseUrl: 'http://127.0.0.1:11434/v1/chat/completions',
    defaultModel: 'qwen2.5-coder:7b',
    models: ['qwen2.5-coder:7b', 'deepseek-coder-v2', 'llama3.2:3b', 'codellama:7b'],
    envKey: 'OLLAMA_API_KEY',
    pricingPer1M: { input: 0.00, output: 0.00 }
  }
};

const DEFAULT_CONFIG = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  temperature: 0.2,
  maxTokens: 4096,
  contextWindowLimit: 64000,
  autoCompactThreshold: 0.80,
  confirmShellCommands: false,
  customBaseUrl: '',
  apiKeys: {},
  pinnedFiles: [],
  memoryNotes: [],
  enabledSkills: ['termux-ops', 'security-audit', 'clean-arch', 'perf-tuning']
};

function ensureDir() {
  if (!fs.existsSync(KARENO_DIR)) {
    fs.mkdirSync(KARENO_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureDir();
  let cfg = { ...DEFAULT_CONFIG, apiKeys: { ...DEFAULT_CONFIG.apiKeys } };
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      cfg = { ...cfg, ...raw, apiKeys: { ...cfg.apiKeys, ...(raw.apiKeys || {}) } };
    } catch (_) {
      // Fallback to defaults if corrupted
    }
  }
  // Hydrate keys from environment variables if not explicitly saved
  for (const [provKey, meta] of Object.entries(PROVIDERS)) {
    if (!cfg.apiKeys[provKey] && process.env[meta.envKey]) {
      cfg.apiKeys[provKey] = process.env[meta.envKey];
    }
  }
  return cfg;
}

function saveConfig(cfg) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function getActiveApiKey(cfg) {
  if (cfg.provider === 'ollama') {
    return cfg.apiKeys.ollama || 'ollama-local';
  }
  return cfg.apiKeys[cfg.provider] || '';
}

module.exports = {
  KARENO_DIR,
  CONFIG_FILE,
  PROVIDERS,
  loadConfig,
  saveConfig,
  getActiveApiKey
};
