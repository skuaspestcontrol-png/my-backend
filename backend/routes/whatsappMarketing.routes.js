const express = require('express');
const { createWhatsAppMarketingController } = require('../controllers/whatsappMarketing.controller');

function createWhatsAppMarketingRouter(deps) {
  const router = express.Router();
  const controller = createWhatsAppMarketingController(deps);

  router.get('/whatsapp-marketing/campaigns', controller.listCampaigns);
  router.get('/whatsapp-marketing/audience/options', controller.audienceOptions);
  router.post('/whatsapp-marketing/audience/preview', controller.previewAudience);
  router.get('/whatsapp-marketing/audience-presets', controller.listPresets);
  router.post('/whatsapp-marketing/audience-presets', controller.savePreset);
  router.delete('/whatsapp-marketing/audience-presets/:id', controller.deletePreset);
  router.get('/whatsapp-marketing/summary', controller.listCampaigns);
  router.post('/whatsapp-marketing/campaigns', controller.createCampaign);
  router.get('/whatsapp-marketing/campaigns/:id', controller.getCampaign);
  router.post('/whatsapp-marketing/campaigns/:id/action', controller.updateCampaignStatus);

  controller.startScheduler();

  return router;
}

module.exports = {
  createWhatsAppMarketingRouter
};
