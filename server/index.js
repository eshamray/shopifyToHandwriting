'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const connectDb = require('./connectDb');

mongoose.connection.on('error', (err) => {
  console.error(`Database Error → ${err}`);
});

async function start() {
  await connectDb(mongoose);
  require('./models/Shopify');

  const app = require('./app');
  app.set('port', 3000);
  const server = app.listen(app.get('port'), () => {
    console.log(`Express running → PORT ${server.address().port}`);
  });
}

start();
