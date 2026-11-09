'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { KARENO_DIR } = require('./config');

const USER_SKILLS_DIR = path.join(KARENO_DIR, 'skills');
const BUNDLED_SKILLS_DIR = path.join(__dirname, '..', 'skills');

function parseSkillFile(filePath, sourceType) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let name = path.basename(path.dirname(filePath));
    let description = 'Custom Kareno skill module';
    let version = '1.0.0';
    let body = raw;

    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
      const fm = fmMatch[1];
      body = fmMatch[2].trim();
      const nameM = fm.match(/^name:\s*(.+)$/m);
      const descM = fm.match(/^description:\s*(.+)$/m);
      const verM = fm.match(/^version:\s*(.+)$/m);
      if (nameM) name = nameM[1].trim().replace(/^["']|["']$/g, '');
      if (descM) description = descM[1].trim().replace(/^["']|["']$/g, '');
      if (verM) version = verM[1].trim().replace(/^["']|["']$/g, '');
    }

    return {
      name,
      description,
      version,
      source: sourceType,
      path: filePath,
      instructions: body
    };
  } catch (_) {
    return null;
  }
}

class SkillManager {
  constructor(config) {
    this.config = config;
    this.skills = new Map();
    this.ensureDirs();
    this.reload();
  }

  ensureDirs() {
    if (!fs.existsSync(USER_SKILLS_DIR)) {
      fs.mkdirSync(USER_SKILLS_DIR, { recursive: true });
    }
  }

  scanDirectory(dirPath, sourceLabel) {
    if (!fs.existsSync(dirPath)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMd = path.join(dirPath, entry.name, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          const parsed = parseSkillFile(skillMd, sourceLabel);
          if (parsed) {
            this.skills.set(parsed.name, parsed);
          }
        }
      }
    }
  }

  reload() {
    this.skills.clear();
    this.scanDirectory(BUNDLED_SKILLS_DIR, 'bundled');
    this.scanDirectory(USER_SKILLS_DIR, 'user');
    const wsSkills = path.join(process.cwd(), '.kareno', 'skills');
    this.scanDirectory(wsSkills, 'workspace');
    return this.skills.size;
  }

  listAll() {
    const enabledSet = new Set(this.config.enabledSkills || []);
    const list = [];
    for (const s of this.skills.values()) {
      list.push({
        ...s,
        enabled: enabledSet.has(s.name)
      });
    }
    return list;
  }

  getActivePromptBlock() {
    const active = this.listAll().filter(s => s.enabled);
    if (active.length === 0) return '';
    const blocks = active.map(
      s => `[SKILL: ${s.name} (${s.version})]\n${s.instructions}`
    );
    return `\n\n# ACTIVE KARENO SKILLS\n${blocks.join('\n\n')}`;
  }

  enable(name) {
    if (!this.skills.has(name)) return false;
    if (!this.config.enabledSkills.includes(name)) {
      this.config.enabledSkills.push(name);
    }
    return true;
  }

  disable(name) {
    const idx = this.config.enabledSkills.indexOf(name);
    if (idx === -1) return false;
    this.config.enabledSkills.splice(idx, 1);
    return true;
  }

  createSkill(name, description = 'Specialized domain skill for Kareno') {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const targetDir = path.join(USER_SKILLS_DIR, cleanName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const skillPath = path.join(targetDir, 'SKILL.md');
    const content = [
      '---',
      `name: ${cleanName}`,
      `description: "${description}"`,
      'version: 1.0.0',
      '---',
      `# ${cleanName.toUpperCase()} Skill`,
      '',
      '## Rules & Guidelines',
      '- Follow minimal, high-velocity coding practices.',
      '- Validate edge cases and avoid unnecessary dependencies.',
      `- Domain focus: ${description}`
    ].join('\n');

    fs.writeFileSync(skillPath, content, 'utf8');
    this.reload();
    this.enable(cleanName);
    return { name: cleanName, path: skillPath };
  }

  removeSkill(name) {
    const skill = this.skills.get(name);
    if (!skill || skill.source === 'bundled') {
      return { ok: false, reason: 'Cannot delete bundled core skill (use /skill:disable instead).' };
    }
    const dir = path.dirname(skill.path);
    fs.rmSync(dir, { recursive: true, force: true });
    this.disable(name);
    this.reload();
    return { ok: true };
  }

  installFromSource(sourceSpec) {
    return new Promise((resolve) => {
      // 1. Check if local file or directory
      if (fs.existsSync(sourceSpec)) {
        const stat = fs.statSync(sourceSpec);
        const mdFile = stat.isDirectory() ? path.join(sourceSpec, 'SKILL.md') : sourceSpec;
        if (!fs.existsSync(mdFile)) {
          return resolve({ ok: false, error: 'No SKILL.md found in local path.' });
        }
        const parsed = parseSkillFile(mdFile, 'user');
        if (!parsed) {
          return resolve({ ok: false, error: 'Failed to parse SKILL.md.' });
        }
        const destDir = path.join(USER_SKILLS_DIR, parsed.name);
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(mdFile, path.join(destDir, 'SKILL.md'));
        this.reload();
        this.enable(parsed.name);
        return resolve({ ok: true, name: parsed.name, path: destDir });
      }

      // 2. Remote URL or GitHub repo shorthand (owner/repo or owner/repo/skill)
      let url = sourceSpec;
      if (!sourceSpec.startsWith('http://') && !sourceSpec.startsWith('https://')) {
        const parts = sourceSpec.split('/');
        if (parts.length === 2) {
          url = `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/main/SKILL.md`;
        } else if (parts.length >= 3) {
          const owner = parts[0];
          const repo = parts[1];
          const sub = parts.slice(2).join('/');
          url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${sub}/SKILL.md`;
        } else {
          return resolve({ ok: false, error: 'Provide a valid path, URL, or GitHub owner/repo.' });
        }
      }

      https.get(url, { headers: { 'User-Agent': 'Kareno-CLI/1.0' } }, (res) => {
        if (res.statusCode !== 200) {
          return resolve({ ok: false, error: `HTTP ${res.statusCode} when fetching ${url}` });
        }
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          const fallbackName = path.basename(sourceSpec).replace(/\.md$/i, '') || `skill-${Date.now()}`;
          const tempName = fallbackName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
          const destDir = path.join(USER_SKILLS_DIR, tempName);
          fs.mkdirSync(destDir, { recursive: true });
          const destFile = path.join(destDir, 'SKILL.md');
          fs.writeFileSync(destFile, data, 'utf8');
          const parsed = parseSkillFile(destFile, 'user');
          const finalName = parsed ? parsed.name : tempName;
          this.reload();
          this.enable(finalName);
          resolve({ ok: true, name: finalName, path: destFile });
        });
      }).on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    });
  }
}

module.exports = {
  SkillManager,
  USER_SKILLS_DIR
};
