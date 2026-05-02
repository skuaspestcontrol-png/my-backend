let cachedSettings = null;
let cachedAt = 0;
const TTL = 5 * 60 * 1000;

const readCachedSettings = async (loader) => {
  const now = Date.now();
  if (cachedSettings && now - cachedAt < TTL) {
    return cachedSettings;
  }

  const next = await loader();
  cachedSettings = next;
  cachedAt = now;
  return cachedSettings;
};

const clearSettingsCache = () => {
  cachedSettings = null;
  cachedAt = 0;
};

module.exports = {
  readCachedSettings,
  clearSettingsCache,
};
