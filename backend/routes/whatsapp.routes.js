const express = require('express');
const multer = require('multer');
const path = require('path');
const { createWhatsAppController } = require('../controllers/whatsapp.controller');

function createWhatsAppRouter(deps) {
  const router = express.Router();
  const controller = createWhatsAppController(deps);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, deps.uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  router.get('/settings/whatsapp', controller.getWhatsAppSettings);
  router.post('/settings/whatsapp', controller.saveWhatsAppSettings);
  router.post('/settings/whatsapp/test', controller.sendTestMessage);

  router.get('/whatsapp/templates', controller.listTemplates);
  router.post('/whatsapp/templates', controller.createTemplate);
  router.put('/whatsapp/templates/:id', controller.updateTemplate);
  router.delete('/whatsapp/templates/:id', controller.deleteTemplate);

  router.post('/whatsapp/preview', controller.preview);
  router.post('/whatsapp/send', controller.send);
  router.post('/whatsapp/send-with-attachment', upload.single('attachment'), (req, res, next) => {
    if (req.body && typeof req.body.contextData === 'string') {
      req.body.contextData = controller.parseJsonSafe(req.body.contextData, {});
    }
    next();
  }, controller.sendWithAttachment);

  router.get('/whatsapp/logs', controller.listLogs);
  router.post('/whatsapp/logs/:id/retry', controller.retryLog);

  return router;
}

module.exports = {
  createWhatsAppRouter
};
