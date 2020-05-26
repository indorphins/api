const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const classesRouter = require('./src/routes/class');
const usersRouter = require('./src/routes/user');
const db = require('./src/db');
const log = require('./src/log');

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

// create ctx object for middleware data
app.use(function (req, res, next) {
	req.ctx = {};
	next();
});

// request logging middleware
app.use(function (req, res, next) {
	log.info({ message: 'request info', req: req, res: res });
	next();
});

app.options('*', cors());

// routes
app.use('/class', classesRouter);
app.use('/user', usersRouter);
app.use('/stripe', stripeRouter);

app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'text/plain');
	res.status(200).send('Great Success!\n');
});

app.get('*', (req, res) => {
	res.status(404).json({
		message: 'route not supported',
	});
});

db.init(() => {
	app.listen(PORT, () => log.info('App started on port', PORT));
});
