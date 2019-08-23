const express = require('express');
const verifyWebhook = require('./middlewares').verifyWebhook;
const Shop = require('./models/Shopify');
const router = express.Router();

router.post('/app/uninstalled', verifyWebhook, async (req, res) => {
  const { domain, myshopify_domain } = req.body;
  //on delete shop or on delete app remove record from db
  try {
    await Shop.remove({shop: domain});
  } catch (error) {
    const webhook = 'on delete app';
    console.error(`Webhook "${webhook}": Removing Shopify record error: ${error}`);
    return res.sendStatus(500);
  }

  return res.sendStatus(200);
});

router.post('/customers/create', verifyWebhook, async (req, res) => {debugger
  const shop = '';

  try {
    const shopRec = await Shop.findOne({shop});
    if (shopRec && shopRec.customerCreatedCampaignId && shopRec.userId) {
      //send handwriting post card
      console.log(`Webhook: customers/create`);
    }
  } catch (error) {
    //TODO figure out if on delete shop or on delete app
    const webhook = 'customers/create';
    console.error(`Webhook "${webhook}": Sending handwriting post card error: ${error}`);
    return res.sendStatus(500);
  }
  return res.sendStatus(200);
});

module.exports = router;
