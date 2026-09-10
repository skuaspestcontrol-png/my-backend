const fs = require('fs');
const path = require('path');

const normalize = (value) => String(value || '').trim();
const now = () => Date.now();

const sessionKeyForUser = (user = {}) => {
  const type = normalize(user.type).toLowerCase() === 'admin' || normalize(user.role).toLowerCase() === 'admin'
    ? 'admin'
    : 'employee';
  const id = normalize(user.id || user.employeeId || user.employeeCode || user.sub || 'admin');
  return `${type}:${id || 'admin'}`;
};

const emptyState = () => ({ users: {} });

const createSessionRevocationStore = ({ filePath }) => {
  const target = path.resolve(filePath);
  const ensureDir = () => fs.mkdirSync(path.dirname(target), { recursive: true });
  const readState = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
      return parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object'
        ? parsed
        : emptyState();
    } catch (_error) {
      return emptyState();
    }
  };
  const writeState = (state) => {
    ensureDir();
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, target);
  };
  const entryFor = (state, user) => {
    const key = sessionKeyForUser(user);
    if (!state.users[key]) state.users[key] = { sessionVersion: 1, revokedAfter: 0 };
    state.users[key].sessionVersion = Math.max(1, Number(state.users[key].sessionVersion || 1));
    state.users[key].revokedAfter = Math.max(0, Number(state.users[key].revokedAfter || 0));
    return { key, entry: state.users[key] };
  };

  return {
    filePath: target,
    sessionKeyForUser,
    getVersion(user) {
      const state = readState();
      return entryFor(state, user).entry.sessionVersion;
    },
    revokeUser(user, reason = '') {
      const state = readState();
      const { key, entry } = entryFor(state, user);
      entry.sessionVersion += 1;
      entry.revokedAfter = now();
      entry.reason = normalize(reason);
      entry.updatedAt = new Date(entry.revokedAfter).toISOString();
      state.users[key] = entry;
      writeState(state);
      return entry;
    },
    isTokenRevoked(payload = {}) {
      const state = readState();
      const key = sessionKeyForUser(payload);
      const entry = state.users[key];
      if (!entry) return false;
      const tokenVersion = Math.max(1, Number(payload.sessionVersion || 1));
      const currentVersion = Math.max(1, Number(entry.sessionVersion || 1));
      if (tokenVersion !== currentVersion) return true;
      const issuedAt = Number(payload.iat || 0);
      const revokedAfter = Number(entry.revokedAfter || 0);
      return Boolean(revokedAfter && issuedAt <= revokedAfter);
    }
  };
};

module.exports = { createSessionRevocationStore, sessionKeyForUser };
