const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bunyan = require('bunyan');
const bformat = require('bunyan-format');

const dailycoRouter = require('./src/routes/dailyco');
const classesRouter = require('./src/routes/classes');
const usersRouter = require('./src/routes/users');
const stripeRouter = require('./src/routes/stripe');

const DBCONN = String(process.env.DATABASE_URL).replace(/'|"/gm, '');
const PORT = process.env.PORT;

var LOG_LEVEL = 30;
var OUTPUT = 'json';

if (process.env.LOG_LEVEL == 'debug') {
	LOG_LEVEL = 20;
	OUTPUT = 'short';
}

const app = express();
const log = bunyan.createLogger({
	name: 'indorphins',
	serializers: {
		err: bunyan.stdSerializers.err,
		req: bunyan.stdSerializers.req,
		res: bunyan.stdSerializers.res,
	},
	level: LOG_LEVEL,
	stream: bformat({
		outputMode: OUTPUT,
		levelInString: true,
	}),
});

function listen() {
	if (app.get('env') === 'test') return;
	app.listen(PORT, () => log.info(`App started`, 'port', PORT));
}

function connect() {
	mongoose.connection.once('open', listen);

	// consider adding autoIndex to false for production
	return mongoose.connect(DBCONN, {
		keepAlive: 1,
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
		useCreateIndex: true,
	});
}

log.info('Connecting to MongoDB', DBCONN);
connect().catch((err) => {
	log.fatal({ msg: 'error connecting to database', err: err });
});

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// request logging middleware
app.use(function (req, res, next) {
	log.info({ message: 'request info', req: req, res: res });
	next();
});

app.options('*', cors());

// routes
app.use('/dailyco', dailycoRouter);
app.use('/classes', classesRouter);
app.use('/users', usersRouter);
app.use('/stripe', stripeRouter);

app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'text/plain');
	res.status(200).send('Great Success!\n');
});
