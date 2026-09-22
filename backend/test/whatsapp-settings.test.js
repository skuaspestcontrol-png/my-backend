const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createWhatsAppController } = require('../controllers/whatsapp.controller');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return response;
};

test('WhatsApp settings save preserves existing credentials when token input is blank', async () => {
  let stored = {
    whatsappApiBaseUrl: 'https://provider.example/api',
    whatsappPhoneNumber: '+919999999999',
    whatsappInstanceId: 'saved-instance',
    whatsappPhoneNumberId: 'saved-instance',
    whatsappAccessToken: 'saved-token',
    whatsappApiActive: true,
    whatsappProviderType: 'custom',
    whatsappTestNumber: '+918888888888'
  };

  const controller = createWhatsAppController({
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-settings-test-')),
    uploadsDir: os.tmpdir(),
    settingsFile: path.join(os.tmpdir(), 'unused-settings.json'),
    readJsonFile: () => ({}),
    loadRuntimeSettings: async () => stored,
    saveRuntimeSettings: async (next) => {
      stored = next;
      return stored;
    },
    withMysqlConnection: null,
    resolveServerOrigin: () => 'https://crm.example'
  });

  const res = createResponse();
  await controller.saveWhatsAppSettings({
    body: {
      whatsappApiBaseUrl: 'https://provider.example/new-api',
      whatsappPhoneNumber: '+917777777777',
      whatsappInstanceId: 'new-instance',
      whatsappAccessToken: '',
      whatsappApiActive: true,
      whatsappProviderType: 'custom'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(stored.whatsappApiBaseUrl, 'https://provider.example/new-api');
  assert.equal(stored.whatsappPhoneNumber, '+917777777777');
  assert.equal(stored.whatsappInstanceId, 'new-instance');
  assert.equal(stored.whatsappPhoneNumberId, 'new-instance');
  assert.equal(stored.whatsappAccessToken, 'saved-token');
  assert.equal(res.body.settings.hasAccessToken, true);
  assert.equal(res.body.settings.accessToken, '');
  assert.equal(res.body.settings.accessTokenMasked, '********oken');
});
