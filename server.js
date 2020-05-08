require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3001;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const loginRouter = require('./routes/login');
const signupRouter = require('./routes/signup');
const profileRouter = require('./routes/profile');
const dailycoRouter = require('./routes/dailyco');
const classesRouter = require('./routes/classes');
const usersRouter = require('./routes/users');
const classesController = require('./controller/classesController');

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

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.options('*', cors()); // include before other routes
// routes
app.use('/signup', signupRouter);
app.use('/profile', profileRouter);
app.use('/dailyco', dailycoRouter);
app.use('/login', loginRouter);
app.use('/classes', classesRouter);
app.use('/users', usersRouter);

// what is this route for?
app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify({ status: `Active` }));
});
// runs every 5 min to check db for expired classes
setInterval(async function () {
	// right now its running the function a extra time - its not affecting the query so its fine for right now
	await classesController
		.checkExpiredClasses()
		.catch((err) => console.log(err));
	console.log('Hi');
}, 300000);
