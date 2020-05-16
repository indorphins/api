const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const classesRouter = require('./src/routes/classes');
const usersRouter = require('./src/routes/users');
const db = require('./src/db');
const log = require('./src/log');

const PORT = process.env.PORT;

const app = express();

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
  log.info({message: "request info", req: req, res: res});
  next();
});

app.options('*', cors());

// routes
app.use('/classes', classesRouter);
app.use('/users', usersRouter);

app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'text/plain');
	res.status(200).send('Great Success!\n');
});

db.init(() => {
	app.listen(PORT, () => log.info("App started on port", PORT));
});