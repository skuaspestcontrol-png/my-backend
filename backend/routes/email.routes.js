const express = require('express');
const multer = require('multer');
const path = require('path');
const { createEmailController } = require('../controllers/email.controller');

function createEmailRouter(deps) {
  const router = express.Router();
  const controller = createEmailController(deps);
  const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.csv', '.xls', '.xlsx']);
  const allowedMimes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]);
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

  router.get('/settings/email', controller.getEmailSettings);
  router.post('/settings/email', controller.saveEmailSettings);
  router.post('/settings/email/test', controller.sendTestEmail);

  router.get('/email/templates', controller.listTemplates);
  router.post('/email/templates', controller.createTemplate);
  router.put('/email/templates/:id', controller.updateTemplate);
  router.delete('/email/templates/:id', controller.deleteTemplate);

  router.post('/email/preview', controller.preview);
  router.post('/email/send', controller.send);
  router.post('/email/send-with-attachment', upload.single('attachment'), (req, res, next) => {
    if (req.body && typeof req.body.contextData === 'string') {
      req.body.contextData = controller.parseJsonSafe(req.body.contextData, {});
    }
    next();
  }, controller.sendWithAttachment);

  router.get('/email/logs', controller.listLogs);
  router.post('/email/logs/:id/retry', controller.retryLog);

  return router;
}

module.exports = {
  createEmailRouter
};
