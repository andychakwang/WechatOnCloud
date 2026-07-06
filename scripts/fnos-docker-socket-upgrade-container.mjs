#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const TARGET = process.env.WOC_TARGET_CONTAINER || 'woc-panel-automation-test';
const IMAGE_PREFIX = process.env.WOC_IMAGE_PREFIX || 'ghcr.io/andychakwang';
const VERSION = process.env.WOC_VERSION || 'andy-automation-usable-r78-2026-07-06';
const PANEL_IMAGE = process.env.WOC_PANEL_IMAGE || `${IMAGE_PREFIX}/woc-panel:${VERSION}`;
const WECHAT_IMAGE = process.env.WOC_WECHAT_IMAGE || `${IMAGE_PREFIX}/wechat-on-cloud:${VERSION}`;
const HELPER_MODE = process.env.WOC_HELPER_MODE === '1';
const PROJECT_DIR = process.env.WOC_PROJECT_DIR || '';
const ALLOWED_HOSTS = process.env.WOC_ALLOWED_HOSTS || '';
const DRY_RUN = process.env.DRY_RUN === '1';

function log(message) {
  process.stdout.write(`[fnos-upgrade] ${message}\n`);
}

function redactEnv(env = []) {
  return env.map((item) =>
    /PASSWORD|TOKEN|SECRET|KEY/i.test(item)
      ? `${String(item).split('=')[0]}=[redacted]`
      : item
  );
}

function dockerRequest(method, requestPath, body, options = {}) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: SOCKET,
        method,
        path: requestPath,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
          if (options.stream) {
            for (const line of chunk.split(/\r?\n/)) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);
                const status = [event.status, event.progress].filter(Boolean).join(' ');
                if (status) log(status);
              } catch {
                log(line);
              }
            }
          }
        });
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          let data = text;
          if (text.trim()) {
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          }
          if (!ok) {
            const err = new Error(`Docker API ${method} ${requestPath} failed with ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.data = data;
            reject(err);
            return;
          }
          resolve(data);
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function docker(method, requestPath, body, options) {
  return dockerRequest(method, requestPath, body, options);
}

function envMap(env = []) {
  const map = new Map();
  for (const item of env) {
    const [key, ...rest] = String(item).split('=');
    if (!key) continue;
    map.set(key, rest.join('='));
  }
  return map;
}

function envArray(map) {
  return Array.from(map.entries()).map(([key, value]) => `${key}=${value}`);
}

function projectDirFromInspect(inspect) {
  if (PROJECT_DIR) return PROJECT_DIR;
  const dataMount = (inspect.Mounts || []).find((mount) => mount.Destination === '/data');
  if (dataMount?.Source) return path.dirname(dataMount.Source);
  for (const bind of inspect.HostConfig?.Binds || []) {
    const [source, dest] = String(bind).split(':');
    if (dest === '/data' && source) return path.dirname(source);
  }
  return '';
}

function updateComposeYaml(text) {
  let next = text;
  next = next.replace(
    /ghcr\.io\/[^/\s]+\/woc-panel:[^\s'"]+/g,
    PANEL_IMAGE
  );
  next = next.replace(
    /ghcr\.io\/[^/\s]+\/wechat-on-cloud:[^\s'"]+/g,
    WECHAT_IMAGE
  );
  next = next.replace(
    /docker\.io\/[^/\s]+\/woc-panel:[^\s'"]+/g,
    PANEL_IMAGE
  );
  next = next.replace(
    /docker\.io\/[^/\s]+\/wechat-on-cloud:[^\s'"]+/g,
    WECHAT_IMAGE
  );
  return next;
}

function findComposeFile(projectDir) {
  for (const name of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    const candidate = path.join(projectDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(projectDir, 'docker-compose.yml');
}

function writeComposeBackup(projectDir) {
  if (!projectDir || !fs.existsSync(projectDir)) {
    log(`compose project directory unavailable: ${projectDir || '(empty)'}`);
    return;
  }
  const composeFile = findComposeFile(projectDir);
  if (!fs.existsSync(composeFile)) {
    log(`compose file not found under ${projectDir}; container will still be recreated`);
    return;
  }
  const current = fs.readFileSync(composeFile, 'utf8');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${composeFile}.bak-${stamp}`;
  fs.copyFileSync(composeFile, backup);
  fs.writeFileSync(composeFile, updateComposeYaml(current));
  log(`compose backed up and updated: ${path.basename(backup)} -> ${path.basename(composeFile)}`);
}

function updateContainerEnv(env = []) {
  const map = envMap(env);
  map.set('WOC_VERSION', VERSION);
  map.set('WOC_WECHAT_IMAGE', WECHAT_IMAGE);
  if (ALLOWED_HOSTS) map.set('PANEL_ALLOWED_HOSTS', ALLOWED_HOSTS);
  return envArray(map);
}

function cleanHostConfig(old = {}) {
  const keys = [
    'AutoRemove',
    'Binds',
    'CapAdd',
    'CapDrop',
    'CgroupnsMode',
    'ConsoleSize',
    'Devices',
    'Dns',
    'DnsOptions',
    'DnsSearch',
    'ExtraHosts',
    'GroupAdd',
    'IpcMode',
    'Isolation',
    'LogConfig',
    'NetworkMode',
    'OomKillDisable',
    'PidMode',
    'PortBindings',
    'Privileged',
    'ReadonlyRootfs',
    'RestartPolicy',
    'Runtime',
    'SecurityOpt',
    'ShmSize',
    'Tmpfs',
    'UTSMode',
    'UsernsMode',
    'VolumeDriver',
    'VolumesFrom',
  ];
  const next = {};
  for (const key of keys) {
    if (old[key] !== undefined && old[key] !== null) next[key] = old[key];
  }
  next.AutoRemove = false;
  return next;
}

function createConfigFromInspect(inspect) {
  const config = inspect.Config || {};
  return {
    Hostname: config.Hostname || '',
    Domainname: config.Domainname || '',
    User: config.User || '',
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false,
    Env: updateContainerEnv(config.Env || []),
    Cmd: config.Cmd || undefined,
    Image: PANEL_IMAGE,
    Labels: config.Labels || {},
    ExposedPorts: config.ExposedPorts || {},
    Entrypoint: config.Entrypoint || undefined,
    WorkingDir: config.WorkingDir || '',
    StopSignal: config.StopSignal || undefined,
    StopTimeout: inspect.HostConfig?.StopTimeout ?? undefined,
    HostConfig: cleanHostConfig(inspect.HostConfig || {}),
  };
}

async function pullImage(image) {
  const [fromImage, tag = 'latest'] = image.split(/:(?!.*:)/);
  log(`pulling ${image}`);
  if (DRY_RUN) return;
  await docker(
    'POST',
    `/images/create?fromImage=${encodeURIComponent(fromImage)}&tag=${encodeURIComponent(tag)}`,
    undefined,
    { stream: true }
  );
}

async function createHelper(inspect, projectDir) {
  const sourcePath = fileURLToPath(import.meta.url);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const helperName = `woc-updater-${Date.now()}`;
  const currentImage = inspect.Config?.Image || PANEL_IMAGE;
  const env = [
    'WOC_HELPER_MODE=1',
    `WOC_TARGET_CONTAINER=${TARGET}`,
    `WOC_VERSION=${VERSION}`,
    `WOC_IMAGE_PREFIX=${IMAGE_PREFIX}`,
    `WOC_PANEL_IMAGE=${PANEL_IMAGE}`,
    `WOC_WECHAT_IMAGE=${WECHAT_IMAGE}`,
    `WOC_PROJECT_DIR=/project`,
    `WOC_ALLOWED_HOSTS=${ALLOWED_HOSTS}`,
    `WOC_UPDATER_SOURCE_B64=${Buffer.from(source, 'utf8').toString('base64')}`,
  ];
  const binds = [`${SOCKET}:${SOCKET}`];
  if (projectDir) binds.push(`${projectDir}:/project`);
  const cmd = [
    'node',
    '-e',
    "const fs=require('fs');fs.writeFileSync('/tmp/fnos-updater.mjs',Buffer.from(process.env.WOC_UPDATER_SOURCE_B64,'base64'));import('/tmp/fnos-updater.mjs').catch((e)=>{console.error(e);process.exit(1);});",
  ];
  log(`starting helper ${helperName} from ${currentImage}`);
  if (DRY_RUN) return helperName;
  const created = await docker('POST', `/containers/create?name=${encodeURIComponent(helperName)}`, {
    Image: currentImage,
    Env: env,
    Cmd: cmd,
    HostConfig: {
      AutoRemove: true,
      Binds: binds,
      RestartPolicy: { Name: 'no' },
    },
  });
  await docker('POST', `/containers/${created.Id}/start`);
  return helperName;
}

async function waitForContainerExit(container, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const inspect = await docker('GET', `/containers/${encodeURIComponent(container)}/json`);
    if (!inspect.State?.Running) return inspect.State?.ExitCode ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${container}`);
}

async function recreateTarget() {
  const inspect = await docker('GET', `/containers/${encodeURIComponent(TARGET)}/json`);
  const projectDir = projectDirFromInspect(inspect);
  log(`target: ${TARGET}`);
  log(`current image: ${inspect.Config?.Image || inspect.Image}`);
  log(`target image: ${PANEL_IMAGE}`);
  log(`compose dir: ${projectDir || '(unknown)'}`);
  log(`env: ${redactEnv(inspect.Config?.Env || []).join(', ')}`);

  if (!HELPER_MODE) {
    const helperName = await createHelper(inspect, projectDir);
    log(`helper started: ${helperName}`);
    log('this terminal may disconnect while the helper replaces the target container');
    return;
  }

  writeComposeBackup(projectDir);
  await pullImage(PANEL_IMAGE);
  await pullImage(WECHAT_IMAGE);

  const backupName = `${TARGET}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const newConfig = createConfigFromInspect(inspect);
  log(`renaming current container to ${backupName}`);
  if (!DRY_RUN) {
    await docker('POST', `/containers/${encodeURIComponent(TARGET)}/stop?t=20`).catch((error) => {
      if (error.statusCode !== 304) throw error;
    });
    await docker('POST', `/containers/${inspect.Id}/rename?name=${encodeURIComponent(backupName)}`);
  }

  let createdId = '';
  try {
    log(`creating replacement ${TARGET}`);
    if (!DRY_RUN) {
      const created = await docker('POST', `/containers/create?name=${encodeURIComponent(TARGET)}`, newConfig);
      createdId = created.Id;
      await docker('POST', `/containers/${createdId}/start`);
      const next = await docker('GET', `/containers/${createdId}/json`);
      if (!next.State?.Running) throw new Error(`replacement is not running: ${next.State?.Status}`);
      log(`replacement running: ${TARGET} (${PANEL_IMAGE})`);
      await docker('DELETE', `/containers/${encodeURIComponent(backupName)}?force=1`);
      log(`removed backup container ${backupName}`);
    }
  } catch (error) {
    log(`replacement failed: ${error.message}`);
    if (!DRY_RUN) {
      if (createdId) await docker('DELETE', `/containers/${createdId}?force=1`).catch(() => {});
      await docker('POST', `/containers/${encodeURIComponent(backupName)}/rename?name=${encodeURIComponent(TARGET)}`).catch(() => {});
      await docker('POST', `/containers/${encodeURIComponent(TARGET)}/start`).catch(() => {});
      log('rolled back to previous container');
    }
    throw error;
  }
}

recreateTarget().catch((error) => {
  console.error('[fnos-upgrade] failed:', error.data || error.stack || error.message);
  process.exit(1);
});
