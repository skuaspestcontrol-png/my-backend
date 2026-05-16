const express = require('express');
const multer = require('multer');
const path = require('path');
const { createWhatsAppController } = require('../controllers/whatsapp.controller');

function createWhatsAppRouter(deps) {
  const router = express.Router();
  const controller = createWhatsAppController(deps);
  const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
  const allowedMimes = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const safeBaseName = (rawName = '') => String(rawName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'attachment';

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, deps.uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(String(file.originalname || '')).toLowerCase();
      const base = safeBaseName(path.basename(String(file.originalname || ''), ext));
      cb(null, `${Date.now()}-${base}${ext}`);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(String(file.originalname || '')).toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();
      if (allowedExtensions.has(ext) && allowedMimes.has(mime)) return cb(null, true);
      return cb(new Error('Attachment type is not allowed'));
    }
  });

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
