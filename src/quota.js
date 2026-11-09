'use strict';

const fs = require('fs');
const path = require('path');
const { KARENO_DIR, PROVIDERS } = require('./config');

const QUOTA_FILE = path.join(KARENO_DIR, 'quota.json');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_QUOTA = {
  date: todayKey(),
  dailyTokenLimit: 500000,
  sessionTokenLimit: 200000,
  dailyBudgetUsd: 5.00,
  rpmLimit: 30,
  dailyInputTokens: 0,
  dailyOutputTokens: 0,
  dailyCostUsd: 0.0,
  dailyRequests: 0,
  lifetimeTokens: 0,
  lifetimeCostUsd: 0.0,
  lifetimeRequests: 0,
  providerUsage: {}
};

class QuotaManager {
  constructor() {
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.sessionCostUsd = 0.0;
    this.sessionRequests = 0;
    this.requestTimestamps = [];
    this.state = this.load();
  }

  load() {
    let data = { ...DEFAULT_QUOTA, providerUsage: {} };
    if (fs.existsSync(QUOTA_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
        data = { ...data, ...parsed, providerUsage: parsed.providerUsage || {} };
      } catch (_) {}
    }
    const today = todayKey();
    if (data.date !== today) {
      data.date = today;
      data.dailyInputTokens = 0;
      data.dailyOutputTokens = 0;
      data.dailyCostUsd = 0.0;
      data.dailyRequests = 0;
      this.save(data);
    }
    return data;
  }

  save(stateObj = this.state) {
    if (!fs.existsSync(KARENO_DIR)) {
      fs.mkdirSync(KARENO_DIR, { recursive: true });
    }
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(stateObj, null, 2), 'utf8');
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(String(text).length / 3.8);
  }

  checkGate() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);

    if (this.requestTimestamps.length >= this.state.rpmLimit) {
      return {
        allowed: false,
        reason: `Rate limit reached (${this.state.rpmLimit} RPM). Wait a few seconds or raise via /rate <rpm>.`
      };
    }

    const dailyTotal = this.state.dailyInputTokens + this.state.dailyOutputTokens;
    if (dailyTotal >= this.state.dailyTokenLimit) {
      return {
        allowed: false,
        reason: `Daily token quota exhausted (${dailyTotal.toLocaleString()} / ${this.state.dailyTokenLimit.toLocaleString()}). Run /quota:set <tokens> or /quota:reset.`
      };
    }

    const sessionTotal = this.sessionInputTokens + this.sessionOutputTokens;
    if (sessionTotal >= this.state.sessionTokenLimit) {
      return {
        allowed: false,
        reason: `Session token quota exhausted (${sessionTotal.toLocaleString()} / ${this.state.sessionTokenLimit.toLocaleString()}). Run /quota:set or /clear.`
      };
    }

    if (this.state.dailyCostUsd >= this.state.dailyBudgetUsd && this.state.dailyBudgetUsd > 0) {
      return {
        allowed: false,
        reason: `Daily USD budget cap reached ($${this.state.dailyCostUsd.toFixed(4)} / $${this.state.dailyBudgetUsd.toFixed(2)}). Adjust with /budget <usd>.`
      };
    }

    return { allowed: true };
  }

  recordUsage(provider, inputTokens, outputTokens) {
    const inTok = Math.max(0, Number(inputTokens) || 0);
    const outTok = Math.max(0, Number(outputTokens) || 0);
    const meta = PROVIDERS[provider] || { pricingPer1M: { input: 1.0, output: 3.0 } };

    const cost =
      (inTok / 1_000_000) * meta.pricingPer1M.input +
      (outTok / 1_000_000) * meta.pricingPer1M.output;

    this.requestTimestamps.push(Date.now());

    this.sessionInputTokens += inTok;
    this.sessionOutputTokens += outTok;
    this.sessionCostUsd += cost;
    this.sessionRequests += 1;

    this.state.dailyInputTokens += inTok;
    this.state.dailyOutputTokens += outTok;
    this.state.dailyCostUsd += cost;
    this.state.dailyRequests += 1;

    this.state.lifetimeTokens += inTok + outTok;
    this.state.lifetimeCostUsd += cost;
    this.state.lifetimeRequests += 1;

    if (!this.state.providerUsage[provider]) {
      this.state.providerUsage[provider] = { tokens: 0, costUsd: 0.0, requests: 0 };
    }
    this.state.providerUsage[provider].tokens += inTok + outTok;
    this.state.providerUsage[provider].costUsd += cost;
    this.state.providerUsage[provider].requests += 1;

    this.save();
    return { inputTokens: inTok, outputTokens: outTok, costUsd: cost };
  }

  getSummary() {
    const dailyTokens = this.state.dailyInputTokens + this.state.dailyOutputTokens;
    const sessionTokens = this.sessionInputTokens + this.sessionOutputTokens;
    const dailyPercent = this.state.dailyTokenLimit > 0
      ? Math.min(100, (dailyTokens / this.state.dailyTokenLimit) * 100)
      : 0;
    const budgetPercent = this.state.dailyBudgetUsd > 0
      ? Math.min(100, (this.state.dailyCostUsd / this.state.dailyBudgetUsd) * 100)
      : 0;

    const now = Date.now();
    const currentRpm = this.requestTimestamps.filter(t => now - t < 60000).length;

    return {
      date: this.state.date,
      dailyTokens,
      dailyInputTokens: this.state.dailyInputTokens,
      dailyOutputTokens: this.state.dailyOutputTokens,
      dailyTokenLimit: this.state.dailyTokenLimit,
      dailyPercent: Math.max(dailyPercent, budgetPercent),
      dailyCost: this.state.dailyCostUsd,
      dailyBudgetUsd: this.state.dailyBudgetUsd,
      dailyRequests: this.state.dailyRequests,
      sessionTokens,
      sessionInputTokens: this.sessionInputTokens,
      sessionOutputTokens: this.sessionOutputTokens,
      sessionTokenLimit: this.state.sessionTokenLimit,
      sessionCost: this.sessionCostUsd,
      sessionRequests: this.sessionRequests,
      currentRpm,
      rpmLimit: this.state.rpmLimit,
      lifetimeTokens: this.state.lifetimeTokens,
      lifetimeCostUsd: this.state.lifetimeCostUsd,
      lifetimeRequests: this.state.lifetimeRequests,
      providerUsage: this.state.providerUsage
    };
  }

  resetDaily() {
    this.state.dailyInputTokens = 0;
    this.state.dailyOutputTokens = 0;
    this.state.dailyCostUsd = 0.0;
    this.state.dailyRequests = 0;
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.sessionCostUsd = 0.0;
    this.sessionRequests = 0;
    this.save();
  }
}

module.exports = {
  QuotaManager
};
