'use strict';

const path = require('path');
const dotenv = require('dotenv').config();
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


const scope = 'read_customers';

//TODO
let registered;

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
  res.json({user: {api_key: 'api_key464546456'}})
});

//install and main uri
app.get('/shopify', (req, res) => {
  if (registered) {
    //req.query
    /*hmac: "c4e13ce1f8e3edff244545688bc389df3632216c0d63da603dc1459ef"
    locale: "en"
    shop: "thehandwriting.myshopify.com"
    timestamp: "1566383028"*/

    const state = nonce();

    res.cookie('state', state, {httpOnly: true});

    const vars = {
      debug: !!TESTING,
      shopOrigin: SHOP_ORIGIN,
      apiKey,
      serviceAddress,
      appName: APP_NAME,
      scope,
      state,
    };
    return res.render('app', vars);
  }


  const shop = req.query.shop;
  if (shop && SHOP_ORIGIN === shop) {
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
    registered = true

    return res.redirect(`https://${SHOP_ORIGIN}/admin/apps/${APP_NAME || ''}`);

    //res.status(200).send('HMAC validated');



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

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
});
