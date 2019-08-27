const mongoose = require('mongoose');

const Shopify = mongoose.Schema({
  shop: {type: String, index: true, required: true},
  //name: String,
  //domain: String,
  //supportEmail: String,
  accessToken: {type: String, required: true},
  scope: String,
  userId: String,
  customerCreatedCampaignId: String,
  onCustomerCreateWebhookId: String,
});

module.exports = mongoose.model('Shopify', Shopify);
