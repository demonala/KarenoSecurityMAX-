'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(REPO_ROOT, 'package.json');
const REMOTE_PKG_URL = 'https://raw.githubusercontent.com/demonala/kareno/main/package.json';
const REMOTE_COMMIT_URL = 'https://api.github.com/repos/demonala/kareno/commits/main';

function getLocalVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    return pkg.version || '1.0.0';
  } catch (_) {
    return '1.0.0';
  }
}

function getLocalCommit() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 1000
    }).trim();
  } catch (_) {
    return '';
  }
}

function fetchJson(urlStr, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      urlStr,
      {
        headers: {
          'User-Agent': 'Kareno-Updater/1.0',
          'Accept': 'application/json'
        },
        timeout: timeoutMs,
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '1' && process.platform === 'win32' ? false : undefined
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 400) {
              return reject(new Error(`HTTP ${res.statusCode}`));
            }
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Update check timed out'));
    });
  });
}

function compareVersions(v1, v2) {
  const p1 = (v1 || '0.0.0').split('.').map(Number);
  const p2 = (v2 || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n2 > n1) return -1; // v2 is newer
    if (n1 > n2) return 1;  // v1 is newer
  }
  return 0;
}

async function checkForUpdates() {
  const localVer = getLocalVersion();
  const localSha = getLocalCommit();

  try {
    const remotePkg = await fetchJson(REMOTE_PKG_URL, 3000);
    const remoteVer = remotePkg.version || localVer;

    let hasUpdate = compareVersions(localVer, remoteVer) < 0;
    let remoteSha = '';
    let commitMessage = '';

    try {
      const commitData = await fetchJson(REMOTE_COMMIT_URL, 3000);
      remoteSha = commitData.sha ? commitData.sha.slice(0, 7) : '';
      commitMessage = commitData.commit && commitData.commit.message
        ? commitData.commit.message.split('\n')[0]
        : '';
      if (!hasUpdate && localSha && remoteSha && localSha !== remoteSha) {
        hasUpdate = true;
      }
    } catch (_) {}

    return {
      hasUpdate,
      currentVersion: localVer,
      latestVersion: remoteVer,
      currentCommit: localSha,
      latestCommit: remoteSha,
      commitMessage
    };
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: localVer,
      error: err.message
    };
  }
}

function performUpdate() {
  const isGit = fs.existsSync(path.join(REPO_ROOT, '.git'));
  if (!isGit) {
    return {
      success: false,
      message: 'Kareno was not installed via Git. Clone from https://github.com/demonala/kareno.git to enable auto-updates.'
    };
  }

  try {
    const pullOut = execSync('git pull --rebase origin main', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    // Re-link binary in Termux if applicable
    if (process.env.PREFIX && fs.existsSync(path.join(process.env.PREFIX, 'bin'))) {
      try {
        const binTarget = path.join(process.env.PREFIX, 'bin', 'kareno');
        const binSrc = path.join(REPO_ROOT, 'bin', 'kareno.js');
        execSync(`ln -sf "${binSrc}" "${binTarget}" && chmod +x "${binTarget}"`, { stdio: 'ignore' });
      } catch (_) {}
    }

    try {
      execSync('npm link', { cwd: REPO_ROOT, stdio: 'ignore', timeout: 8000 });
    } catch (_) {}

    return {
      success: true,
      output: pullOut,
      newVersion: getLocalVersion(),
      newCommit: getLocalCommit()
    };
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    return {
      success: false,
      message: stderr || stdout || err.message
    };
  }
}

module.exports = {
  getLocalVersion,
  getLocalCommit,
  checkForUpdates,
  performUpdate
};
