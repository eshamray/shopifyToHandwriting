const express = require('express');
const verifyWebhook = require('./middlewares').verifyWebhook;
const Shop = require('./models/Shopify');
const router = express.Router();

router.post('/app/uninstalled', verifyWebhook, async (req, res) => {
  const { domain, myshopify_domain } = req.body;
  //on delete shop or on delete app remove record from db
  const { innerShopId } = req.query;
  try {
    await Shop.remove({shop: domain, _id: innerShopId});
  } catch (error) {
    const webhook = 'on delete app';
    console.error(`Webhook "${webhook}": Removing Shopify record (shop: "${domain}", innerShopId: "${innerShopId}") error: ${error}`);
    return res.sendStatus(500).json({success: false, error: 'Account was connected earlier' });
  }

  return res.sendStatus(200).json({success: true});
});

router.post('/customers/create', verifyWebhook, async (req, res) => {
  const { ['x-shopify-shop-domain']: shop } = req.headers;
  const { id } = req.body;
  try {
    const shopRec = await Shop.findOne({shop});
    if (shopRec && shopRec.customerCreatedCampaignId && shopRec.userId) {
      //send handwriting post card
      console.log(`Webhook: customers/create id: ${id}`);
    }
  } catch (error) {
    //TODO figure out if on delete shop or on delete app
    const webhook = 'customers/create';
    console.error(`Webhook "${webhook}": Sending handwriting post card error: ${error}`);
    return res.sendStatus(500).json({success: false});
  }
  return res.sendStatus(200).json({success: true});
});

module.exports = router;
