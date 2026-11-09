'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { PROVIDERS, getActiveApiKey } = require('./config');
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
        timeout: timeoutMs
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

  // OpenAI-compatible protocol (DeepSeek, OpenAI, Groq, Gemini, OpenRouter, Ollama)
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
