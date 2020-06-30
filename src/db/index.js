const process = require('process');
const mongoose = require('mongoose');
const log = require('../log');

const DBCONN = String(process.env.DATABASE_URL).replace(/'|"/gm, '');

function connect(callback) {
  mongoose.connection.once('open', callback);
  const index = process.env.INIT_DB == "true";

	// consider adding autoIndex to false for production
	return mongoose.connect(DBCONN, {
		dbName: process.env.DATABASE_NAME,
		keepAlive: 1,
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
    useCreateIndex: index,
    autoIndex: index,
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
	});
}

function init(callback) {
  log.info('Connecting to MongoDB', DBCONN);
  return connect(callback).catch((err) => {
    log.fatal({msg: "error connecting to database", err: err});
  });
}

module.exports = {
  init,
}