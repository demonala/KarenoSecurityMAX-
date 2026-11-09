'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { PROVIDERS, getActiveApiKey, saveConfig } = require('./config');
const { TOOL_SCHEMAS } = require('./tools');

function postJson(urlStr, headers, bodyObj, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(bodyObj);

    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'Kareno-CLI/1.0 (Autonomous Terminal Agent)',
          ...headers
        },
        timeout: timeoutMs,
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '1' && process.platform === 'win32' ? false : undefined
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (res.statusCode >= 400) {
              const errMsg =
                (json.error && (json.error.message || JSON.stringify(json.error))) ||
                raw.slice(0, 300);
              return reject(new Error(`HTTP ${res.statusCode}: ${errMsg}`));
            }
            resolve(json);
          } catch (e) {
            reject(new Error(`Invalid JSON from provider (HTTP ${res.statusCode}): ${raw.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Provider API request timed out.'));
    });

    req.write(payload);
    req.end();
  });
}

async function callModel(config, systemPrompt, messages, enableTools = true) {
  const providerKey = config.provider || 'deepseek';
  const provMeta = PROVIDERS[providerKey] || PROVIDERS.deepseek;
  const apiKey = getActiveApiKey(config);

  if (!apiKey && providerKey !== 'ollama') {
    throw new Error(
      `No API key configured for provider "${providerKey}". Run: /key:set <your_api_key> or /provider:set <name>`
    );
  }

  const endpoint = config.customBaseUrl || provMeta.baseUrl;

  // Anthropic native protocol
  if (providerKey === 'anthropic') {
    const anthropicTools = enableTools
      ? TOOL_SCHEMAS.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }))
      : undefined;

    const anthropicMessages = messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.tool_call_id,
              content: String(m.content)
            }
          ]
        };
      }
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        const blocks = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls) {
          let parsedArgs = {};
          try { parsedArgs = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: parsedArgs
          });
        }
        return { role: 'assistant', content: blocks };
      }
      return { role: m.role === 'system' ? 'user' : m.role, content: String(m.content || '') };
    });

    const body = {
      model: config.model || provMeta.defaultModel,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0.2,
      system: systemPrompt,
      messages: anthropicMessages
    };
    if (anthropicTools) body.tools = anthropicTools;

    const res = await postJson(
      endpoint,
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body
    );

    let textContent = '';
    const toolCalls = [];
    for (const block of res.content || []) {
      if (block.type === 'text') textContent += block.text;
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {})
          }
        });
      }
    }

    const usage = res.usage || {};
    return {
      content: textContent,
      toolCalls,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0
    };
  }

  // Google Gemini Native Protocol (Generative Language v1beta)
  if (providerKey === 'gemini') {
    const requestedModel = config.model || provMeta.defaultModel || 'gemini-3.5-flash';
    const baseUrl = (config.customBaseUrl || provMeta.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');

    const geminiTools = enableTools ? [
      {
        function_declarations: TOOL_SCHEMAS.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }
    ] : undefined;

    const geminiContents = [];
    for (const m of messages) {
      if (m.role === 'tool') {
        geminiContents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.name,
                response: { result: String(m.content) }
              }
            }
          ]
        });
      } else if (m.role === 'assistant') {
        if (m.geminiParts && m.geminiParts.length > 0) {
          geminiContents.push({
            role: 'model',
            parts: m.geminiParts
          });
        } else if (m.tool_calls && m.tool_calls.length > 0) {
          const parts = [];
          if (m.content) parts.push({ text: m.content });
          for (const tc of m.tool_calls) {
            let parsedArgs = {};
            try {
              parsedArgs = typeof tc.function?.arguments === 'string'
                ? JSON.parse(tc.function.arguments || '{}')
                : (tc.function?.arguments || {});
            } catch (_) {}
            parts.push({
              functionCall: {
                name: tc.function?.name || tc.name,
                args: parsedArgs,
                id: tc.id
              }
            });
          }
          geminiContents.push({ role: 'model', parts });
        } else {
          geminiContents.push({
            role: 'model',
            parts: [{ text: String(m.content || '') }]
          });
        }
      } else {
        geminiContents.push({
          role: 'user',
          parts: [{ text: String(m.content || '') }]
        });
      }
    }

    const body = {
      contents: geminiContents,
      generationConfig: {
        temperature: config.temperature ?? 0.2,
        maxOutputTokens: config.maxTokens || 4096
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      body.system_instruction = {
        parts: [{ text: systemPrompt }]
      };
    }
    if (geminiTools) {
      body.tools = geminiTools;
    }

    const headers = {
      'x-goog-api-key': apiKey
    };

    const fallbackCandidates = [
      requestedModel,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite'
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let res;
    let lastError;
    let activeModel = requestedModel;

    for (let i = 0; i < fallbackCandidates.length; i++) {
      const modelToTry = fallbackCandidates[i];
      try {
        const url = `${baseUrl}/models/${modelToTry}:generateContent`;
        const timeoutMs = modelToTry === 'gemini-3.8-flash' ? 10000 : 45000;
        res = await postJson(url, headers, body, timeoutMs);
        activeModel = modelToTry;
        if (config.model !== modelToTry) {
          config.model = modelToTry;
          saveConfig(config);
        }
        break;
      } catch (err) {
        lastError = err;
        const isRecoverable = err.message.includes('503') ||
          err.message.includes('429') ||
          err.message.includes('timed out') ||
          err.message.includes('ECONNABORTED') ||
          err.message.includes('high demand') ||
          err.message.includes('404');
        if (!isRecoverable || i === fallbackCandidates.length - 1) {
          throw err;
        }
      }
    }

    const candidate = res.candidates && res.candidates[0];
    const candidateContent = candidate && candidate.content;
    const parts = (candidateContent && candidateContent.parts) || [];

    let textContent = '';
    const toolCalls = [];

    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        const fnName = part.functionCall.name;
        toolCalls.push({
          id: part.functionCall.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'function',
          name: fnName,
          function: {
            name: fnName,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      }
    }

    const usage = res.usageMetadata || {};
    return {
      content: textContent,
      toolCalls,
      geminiParts: parts,
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0
    };
  }

  // OpenAI-compatible protocol (DeepSeek, OpenAI, Groq, OpenRouter, Ollama)
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  const body = {
    model: config.model || provMeta.defaultModel,
    messages: fullMessages,
    temperature: config.temperature ?? 0.2,
    max_tokens: config.maxTokens || 4096
  };
  if (enableTools) {
    body.tools = TOOL_SCHEMAS;
    body.tool_choice = 'auto';
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`
  };
  if (providerKey === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/demonala/kareno';
    headers['X-Title'] = 'Kareno CLI';
  }

  const res = await postJson(endpoint, headers, body);
  const choice = (res.choices && res.choices[0]) || {};
  const msg = choice.message || {};
  const usage = res.usage || {};

  return {
    content: msg.content || '',
    toolCalls: msg.tool_calls || [],
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0
  };
}

module.exports = {
  callModel
};
