const path = require('path');
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');
const { verifyOAuth } = require('./helpers');
const consolidate = require('consolidate')

const {
  SHOP_ORIGIN, APP_NAME, API_URL, TESTING = false, API_VERSION,
  SHOPIFY_API_KEY: apiKey, SHOPIFY_API_SECRET: apiSecret,
  SERVICE_ADDRESS: serviceAddress,
} = process.env;

//https://help.shopify.com/en/api/getting-started/authentication/oauth/scopes
const scope = 'read_customers,read_content,write_content';

//TODO
let registered = true;
let accountConnected = true;

// view engine setup
// assign the swig engine to .hbs files
app.engine('hbs', consolidate.handlebars);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');


//app.use('/', express.static(path.resolve(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public')));

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

app.get('/shopify/settings', async (req, res) => {
  const state = nonce();

  res.cookie('state', state, {httpOnly: true});
  const userId = '545445';
  const campaigns = accountConnected ? await getUserCampaigns(userId) : [];
debugger
  const shop = req.query.shop;//thehandwriting.myshopify.com

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
  };
  return res.render('app', vars);
});

//install and main uri
app.get('/shopify', (req, res) => {
  const shop = req.query.shop;
  if (shop) {
    const state = nonce();
    const redirectUri = serviceAddress + '/shopify/callback';
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
app.get('/shopify/callback', (req, res) => {
  const { shop, hmac, code, state } = req.query;
  const stateCookie = cookie.parse(req.headers.cookie || '').state;

  if (stateCookie && state !== stateCookie) {
    return res.status(403).send('Request origin cannot be verified');
  }


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
      hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac)
    } catch (e) {
      hashEquals = false;
    };

    if (!hashEquals) {
      return res.status(400).send('HMAC validation failed');
    }

    //TODO save in DB
    if (!registered) {
      registered = true;
      return res.redirect(`https://${shop}/admin/apps/${APP_NAME || ''}`);
    } else {
      const state = nonce();
      const redirectUri = serviceAddress + `/shopify/settings`;
      const installUrl = 'https://' + shop +
        '/admin/oauth/authorize?client_id=' + apiKey +
        '&scope=' + scope +
        '&state=' + state +
        '&redirect_uri=' + redirectUri;

      res.cookie('state', state, {httpOnly: true});
      res.redirect(installUrl);
    }



    //I don't if I need to use access_token to make direct requests from firebase to shopify service
    //probably I need to return html page with input fields (campaign id)

    //Exchange temporary code for a permanent access token
    /*const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
    const accessTokenPayload = {
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    };

    request.post(accessTokenRequestUrl, { json: accessTokenPayload })
      .then((accessTokenResponse) => {
        const accessToken = accessTokenResponse.access_token;

        res.status(200).send("Got an access token, let's do something with it");
        // TODO
        // Use access token to make API call to 'shop' endpoint
      })
      .catch((error) => {
        res.status(error.statusCode).send(error.error.error_description);
      });*/

  } else {
    res.status(400).send('Required parameters missing');
  }
});

function getUserCampaigns(userId) {
  const campaigns = [
    '111eWCE6o2I0Y1aFxFxa', '222eW346o2I0Y1aFxFxa', '333eWCE6o2I0Y1aFxFxa'
  ];
  return Promise.resolve(campaigns);
}

module.exports = app;
