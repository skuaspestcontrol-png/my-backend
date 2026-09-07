const express = require('express');
const { createWhatsAppMarketingController } = require('../controllers/whatsappMarketing.controller');

function createWhatsAppMarketingRouter(deps) {
  const router = express.Router();
  const controller = createWhatsAppMarketingController(deps);

  router.get('/whatsapp-marketing/campaigns', controller.listCampaigns);
  router.get('/whatsapp-marketing/summary', (req, res) => {
    return res.json(controller.getSummary(controller._getCampaigns()));
  });
  router.post('/whatsapp-marketing/campaigns', controller.createCampaign);

  return router;
}

module.exports = {
  createWhatsAppMarketingRouter
};
