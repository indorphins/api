require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3001;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

<<<<<<< HEAD:server.js
const dailycoRouter = require('./routes/dailyco');
const classesRouter = require('./routes/classes');
const usersRouter = require('./routes/users');

function listen() {
	if (app.get('env') === 'test') return;
	app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
	console.log('Express app started on port ' + PORT);
}

function connect() {
	mongoose.connection
		.on('error', console.log)
		.on('disconnected', connect)
		.once('open', listen);
	// consider adding autoIndex to false for production
	return mongoose.connect(process.env.DATABASE_URL, {
		keepAlive: 1,
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
	});
}

connect();
=======
const loginRouter = require('./src/routes/login');
const signupRouter = require('./src/routes/signup');
const profileRouter = require('./src/routes/profile');
const dailycoRouter = require('./src/routes/dailyco');
const classesRouter = require('./src/routes/classes');
const classesController = require('./src/controller/classesController');
>>>>>>> master:index.js

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.options('*', cors());

// routes
app.use('/dailyco', dailycoRouter);
app.use('/classes', classesRouter);
app.use('/users', usersRouter);

// what is this route for?
app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify({ status: `Active` }));
});
