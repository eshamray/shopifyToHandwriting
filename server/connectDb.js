module.exports = function (mongoose) {
  return new Promise(function(resolve, reject) {
    const connectionString = 'mongodb://localhost:27017/handwritingShopify';

    mongoose.Promise = Promise;

    mongoose.connect(connectionString, {
      //useMongoClient: true,
      autoReconnect: true,
      reconnectTries: 3,
      reconnectInterval: 500,
      poolSize: 10,
    }, function (err) {
      if (!err) {
        resolve(mongoose);
      } else {
        reject(err);
      }
    });
  })
};
