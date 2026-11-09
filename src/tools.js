'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const UI = require('./ui');

const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file from disk with optional line range.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute file path' },
          start_line: { type: 'integer', description: '1-based start line (optional)' },
          end_line: { type: 'integer', description: '1-based end line (optional)' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with full content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute file path' },
          content: { type: 'string', description: 'Complete file content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace an exact target snippet in an existing file with replacement text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to modify' },
          target: { type: 'string', description: 'Exact existing text block to replace' },
          replacement: { type: 'string', description: 'New text block' }
        },
        required: ['path', 'target', 'replacement']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and subdirectories in a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (defaults to current working directory)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_code',
      description: 'Search for a pattern or string across files in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text or regex string' },
          directory: { type: 'string', description: 'Optional sub-directory to scope search' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command in the workspace and return stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' }
        },
        required: ['command']
      }
    }
  }
];

function resolveWorkspacePath(p) {
  if (!p) return process.cwd();
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function executeTool(name, args = {}) {
  const t0 = Date.now();
  try {
    if (name === 'read_file') {
      const full = resolveWorkspacePath(args.path);
      if (!fs.existsSync(full)) {
        console.log(UI.toolStep('read', args.path, 'ERR', 'File not found'));
        return `Error: File not found: ${args.path}`;
      }
      const raw = fs.readFileSync(full, 'utf8');
      const lines = raw.split('\n');
      const start = Math.max(1, Number(args.start_line) || 1);
      const end = Math.min(lines.length, Number(args.end_line) || Math.min(lines.length, start + 250));
      const slice = lines.slice(start - 1, end).map((l, idx) => `${start + idx}: ${l}`).join('\n');
      console.log(UI.toolStep('read', args.path, 'OK', `${start}-${end} of ${lines.length} lines · ${Date.now() - t0}ms`));
      return slice;
    }

    if (name === 'write_file') {
      const full = resolveWorkspacePath(args.path);
      const dir = path.dirname(full);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const oldContent = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
      fs.writeFileSync(full, args.content, 'utf8');
      const linesCount = String(args.content).split('\n').length;
      console.log(UI.toolStep('write', args.path, 'OK', `${linesCount} lines · ${Date.now() - t0}ms`));
      if (oldContent) {
        console.log(UI.renderDiff(args.path, oldContent, args.content));
      }
      return `Successfully wrote ${linesCount} lines to ${args.path}`;
    }

    if (name === 'edit_file') {
      const full = resolveWorkspacePath(args.path);
      if (!fs.existsSync(full)) {
        console.log(UI.toolStep('edit', args.path, 'ERR', 'File not found'));
        return `Error: File not found: ${args.path}`;
      }
      const oldContent = fs.readFileSync(full, 'utf8');
      if (!oldContent.includes(args.target)) {
        console.log(UI.toolStep('edit', args.path, 'WARN', 'Target snippet mismatch'));
        return `Error: Target block not found in ${args.path}. Read the file first to verify exact whitespace.`;
      }
      const newContent = oldContent.replace(args.target, args.replacement);
      fs.writeFileSync(full, newContent, 'utf8');
      console.log(UI.toolStep('edit', args.path, 'OK', `updated · ${Date.now() - t0}ms`));
      console.log(UI.renderDiff(args.path, args.target, args.replacement));
      return `Successfully edited ${args.path}`;
    }

    if (name === 'list_dir') {
      const full = resolveWorkspacePath(args.path || '.');
      if (!fs.existsSync(full)) {
        return `Error: Directory not found: ${args.path}`;
      }
      const items = fs.readdirSync(full, { withFileTypes: true }).map(d => {
        if (d.isDirectory()) return `[DIR]  ${d.name}/`;
        const sz = fs.statSync(path.join(full, d.name)).size;
        return `[FILE] ${d.name} (${sz} B)`;
      });
      console.log(UI.toolStep('list', args.path || '.', 'OK', `${items.length} entries · ${Date.now() - t0}ms`));
      return items.join('\n') || '(empty directory)';
    }

    if (name === 'grep_code') {
      const baseDir = resolveWorkspacePath(args.directory || '.');
      const results = [];
      const regex = new RegExp(args.query, 'i');

      function walk(dir, depth = 0) {
        if (depth > 5 || results.length >= 60) return;
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
          return;
        }
        for (const e of entries) {
          if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(e.name)) continue;
          const p = path.join(dir, e.name);
          if (e.isDirectory()) {
            walk(p, depth + 1);
          } else if (e.isFile()) {
            try {
              const stat = fs.statSync(p);
              if (stat.size > 512 * 1024) continue;
              const content = fs.readFileSync(p, 'utf8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  const rel = path.relative(process.cwd(), p);
                  results.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
                  if (results.length >= 60) break;
                }
              }
            } catch (_) {}
          }
        }
      }

      walk(baseDir);
      console.log(UI.toolStep('grep', args.query, 'OK', `${results.length} matches · ${Date.now() - t0}ms`));
      return results.length > 0 ? results.join('\n') : `No matches found for "${args.query}"`;
    }

    if (name === 'run_command') {
      console.log(UI.toolStep('exec', args.command, 'RUN', 'running...'));
      try {
        const out = execSync(args.command, {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 30000,
          maxBuffer: 4 * 1024 * 1024
        });
        console.log(UI.toolStep('exec', args.command, 'OK', `${Date.now() - t0}ms`));
        return out.trim() || '(command exited with 0 and no output)';
      } catch (err) {
        console.log(UI.toolStep('exec', args.command, 'ERR', `exit ${err.status || 1}`));
        const stderr = err.stderr ? String(err.stderr).trim() : '';
        const stdout = err.stdout ? String(err.stdout).trim() : '';
        return `Command failed (exit ${err.status || 1}):\n${stdout}\n${stderr}`.trim();
      }
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool execution error (${name}): ${err.message}`;
  }
}

module.exports = {
  TOOL_SCHEMAS,
  executeTool,
  resolveWorkspacePath
};
