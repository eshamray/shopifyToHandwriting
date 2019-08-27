const crypto = require('crypto');
const request = require('request-promise');
const querystring = require('querystring');

const {
  SHOP_ORIGIN, APP_NAME, API_URL, TESTING = false, API_VERSION,
  SHOPIFY_API_KEY: apiKey, SHOPIFY_API_SECRET: apiSecret,
  SERVICE_ADDRESS: serviceAddress,
} = process.env;

module.exports = {
  verifyHmac(data, hmac) {
    if (!hmac) {
      return false;
    } else if (!data || typeof data !== 'object') {
      return false;
    }
    const calculatedSignature = crypto.createHmac('sha256', apiSecret)
      .update(Buffer.from(data), 'utf8')
      .digest('base64');
    return calculatedSignature === hmac;
  },

  verifyOAuth(query = {}) {
    if (!query.hmac) {
      return false;
    }
    const hmac = query.hmac;
    // delete query.hmac;
    // const sortedQuery = Object.keys(query).map(key => `${key}=${Array(query[key]).join(',')}`).sort().join('&');
    // const calculatedSignature = crypto.createHmac('sha256', apiSecret).update(sortedQuery).digest('hex');
    //
    // return calculatedSignature === hmac;

    const map = Object.assign({}, query);
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

    return crypto.timingSafeEqual(generatedHash, providedHmac);
  },

  obtainAccessToken(shop, code) {
    //Exchange temporary code for a permanent access token
    const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
    const accessTokenPayload = {
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    };

    return request.post(accessTokenRequestUrl, { json: accessTokenPayload });
  },

};
