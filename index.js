const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
//const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const classesRouter = require('./src/routes/class');
const usersRouter = require('./src/routes/user');
const stripeRouter = require('./src/routes/stripe');
const instructorsRouter = require('./src/routes/instructor');
const stripe = require('./src/handlers/stripe');
const redis = require('./src/cache');
const auth = require('./src/auth');
const db = require('./src/db');
const log = require('./src/log');

const PORT = process.env.PORT;

const app = express();

app.use(cors());
app.post('/stripe/invoices', bodyParser.raw({type: 'application/json'}), stripe.webhook.invoiceWebhook)
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
app.use('/instructor', instructorsRouter);


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
	auth.init();
	try {
		redis.init();
	} catch(e) {
		log.fatal("redis connection", e);
	}
	app.listen(PORT, () => log.info("App started on port", PORT));
});
