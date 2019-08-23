const path = require('path');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
//const request = require('request-promise');
const { verifyOAuth, obtainingAccessToken } = require('./helpers');
const consolidate = require('consolidate');
const Shop = require('./models/Shopify');
const ShopifyAPI = require('shopify-api-node');
const webhook = require('./webhook');

const {
  APP_NAME, TESTING = false, API_VERSION: apiVersion,
  SHOPIFY_API_KEY: apiKey, SHOPIFY_API_SECRET: apiSecret,
  SERVICE_ADDRESS: serviceAddress,
} = process.env;

const WEBHOOK_ROUTE = '/shopify/webhook';
const INSTALL_ROUTE = '/shopify';
const CALLBACK_ROUTE = '/shopify/callback';
const SETTINGS_ROUTE = '/shopify/settings';

//https://help.shopify.com/en/api/getting-started/authentication/oauth/scopes
const scope = 'read_customers,read_content,write_content';

// view engine setup
// assign the swig engine to .hbs files
app.engine('hbs', consolidate.handlebars);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');


app.use(bodyParser.json({
    type:'application/json',
    limit: '50mb',
    verify: function(req, res, buf) {
      if (req.url.startsWith('/shopify/webhook')){
        req.rawbody = buf;
      }
    }
  })
);


app.use(express.static(path.join(__dirname, '../public')));

app.use(WEBHOOK_ROUTE, webhook);

app.get('/error', (req, res) => res.render('error', { message: 'Something went wrong!' }));

//TODO will be done with google service   verifyPassword
app.post('/auth', (req, res) => {
  res.json({success: true, user: {api_key: 'api_key464546456'}})
});

app.get('/userCampaigns', async (req, res) => {
  const userId = '4545454';
  const campaigns = await getUserCampaigns(userId);
  res.json({success: true, campaigns})
});

app.get(SETTINGS_ROUTE, async (req, res) => {
  const state = nonce();

  res.cookie('state', state, {httpOnly: true});

  const shop = req.query.shop;

  const shopRec = await Shop.findOne({shop});

  if (!shopRec) {
    //to install
    const query = Object.keys(req.query).map((key) => `${key}=${req.query[key]}`).join('&');
    return res.redirect(`${INSTALL_ROUTE}?${query}`);
  }

  try {
    if (verifyOAuth(req.query)) {
      const accountConnected = !!shopRec.userId;
      let customerCreatedCampaignId = '';
      let campaigns = [];
      let customerCreatedNotifyActive = false;

      if (accountConnected) {
        customerCreatedCampaignId = shopRec.customerCreatedCampaignId;
        const { shop, userId, accessToken, } = shopRec;
        const promises = [
          getUserCampaigns(userId),
          isCustomerCreatedNotifyActive(shop, accessToken),
        ];
        ([ campaigns, customerCreatedNotifyActive ] = await Promise.all(promises));
      }

      const vars = {
        debug: !!TESTING,
        shopOrigin: shop,
        apiKey,
        serviceAddress,
        appName: APP_NAME,
        scope,
        state,
        accountConnected,

        connectAccountSectionClass: accountConnected ? 'hidden' : '',
        notificationPreferenceSectionClass: campaigns.length ? '' : 'hidden',
        settingsSectionClass: accountConnected ? '' : 'hidden',
        campaigns,
        customerCreatedCampaignId,
        customerCreatedNotifyActive,
      };
      return res.render('app', vars);
    } else {
      return res.render('index', { title: req.query.shop });
    }
  } catch (error) {
    const vars = {message: 'Something went wrong!', error: TESTING ? error : {}};
    res.render('error', vars);
  }
});

//install and main uri
app.get(INSTALL_ROUTE, (req, res) => {
  const shop = req.query.shop;
  if (shop) {
    //const shopAPI = new ShopifyAPI({...});
    //const redirectURI = shopAPI.buildAuthURL();
    const state = nonce();
    const redirectUri = serviceAddress + CALLBACK_ROUTE;
    const installUrl = 'https://' + shop +
      '/admin/oauth/authorize?client_id=' + apiKey +
      '&scope=' + scope +
      '&state=' + state +
      '&redirect_uri=' + redirectUri;

    res.cookie('state', state, {httpOnly: true});
    res.redirect(installUrl);
  } else {
    return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
  }
});

//redirect_uri
app.get(CALLBACK_ROUTE, async (req, res) => {
  const { shop, hmac, code, state } = req.query;
  const stateCookie = cookie.parse(req.headers.cookie || '').state;

  if (stateCookie && state !== stateCookie) {
    return res.status(403).send('Request origin cannot be verified');
  }

  try {
    if (shop && hmac && code) {
      const map = Object.assign({}, req.query);
      delete map['signature'];
      delete map['hmac'];
      const message = querystring.stringify(map);
      const providedHmac = Buffer.from(hmac, 'utf-8');
      const generatedHash = Buffer.from(
        crypto
          .createHmac('sha256', apiSecret)
          .update(message)
          .digest('hex'),
        'utf-8'
      );
      let hashEquals = false;

      try {
        hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
      } catch (e) {
        hashEquals = false;
      };

      if (!hashEquals) {
        return res.status(400).send('HMAC validation failed');
      }

      const shopRec = await Shop.findOne({shop});

      if (shopRec) {
        //how often we should receive new access token?
        const state = nonce();
        const redirectUri = serviceAddress + SETTINGS_ROUTE;
        const installUrl = 'https://' + shop +
          '/admin/oauth/authorize?client_id=' + apiKey +
          '&scope=' + scope +
          '&state=' + state +
          '&redirect_uri=' + redirectUri;

        res.cookie('state', state, {httpOnly: true});
        res.redirect(installUrl);

      } else {
        const accessTokenResponse = await obtainingAccessToken(shop, code);
        const { access_token: accessToken, scope } = accessTokenResponse;

        const newShop = new Shop({
          shop,
          scope,
          accessToken,
        });

        await newShop.save();

        createOnDeleteWebhook({shop, accessToken, apiVersion})
          .then(result => {
            console.log('createOnDeleteWebhook', result);
            return
          })
          .catch(error => {
            console.error(`Creating on delete app webhook error: ${error}`);
          });

        return res.redirect(`https://${shop}/admin/apps/${APP_NAME || ''}`);
      }
    } else {
      res.status(400).send('Required parameters missing');
    }
  } catch (error) {
    const vars = {message: 'Something went wrong!', error: TESTING ? error : {}};
    res.render('error', vars);
  }
});

function getUserCampaigns(userId) {
  const campaigns = [
    '111eWCE6o2I0Y1aFxFxa', '222eW346o2I0Y1aFxFxa', '333eWCE6o2I0Y1aFxFxa'
  ];
  return Promise.resolve(campaigns);
}

async function isCustomerCreatedNotifyActive(shop, accessToken) {
  const shopAPI = new ShopifyAPI({
    shopName: shop,
    accessToken,
    apiVersion,
  });
  //получаем webhook на создание нового Customer
  //true/false
}

//add webhook on delete shop
//add webhook on delete app
async function createOnDeleteWebhook({shop, accessToken, apiVersion}) {
  const shopAPI = new ShopifyAPI({
    shopName: shop,
    accessToken,
    apiVersion,
  });

  const webhookParams = {
    topic: 'app/uninstalled',
    address: `${serviceAddress}${WEBHOOK_ROUTE}/app/uninstalled/`,
    format: 'json',
    fields: ['domain', 'myshopify_domain'],
  };
  return shopAPI.webhook.create(webhookParams);
}

async function createOnCustomerCreateWebhook({shop, accessToken, apiVersion}) {
  const shopAPI = new ShopifyAPI({
    shopName: shop,
    accessToken,
    apiVersion,
  });
  const webhookParams = {
    topic: 'customers/create',
    address: `${serviceAddress}${WEBHOOK_ROUTE}/customers/create/`,
    format: 'json',
    fields: ['domain', 'myshopify_domain'],
  };
  return shopAPI.webhook.create(webhookParams);
}

module.exports = app;
