const express = require('express');
const multer = require('multer');
const { createEmailController } = require('../controllers/email.controller');

function createEmailRouter(deps) {
  const router = express.Router();
  const controller = createEmailController(deps);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, deps.uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

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
