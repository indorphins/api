const express = require('express');
const app = express();
const PORT = 3001;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const loginRouter = require('./src/routes/login');
const signupRouter = require('./src/routes/signup');
const profileRouter = require('./src/routes/profile');
const dailycoRouter = require('./src/routes/dailyco');
const classesRouter = require('./src/routes/classes');
const classesController = require('./src/controller/classesController');

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

// what is this route for? 
app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify({ status: `Active` }));
});
// runs every 5 min to check db for expired classes
setInterval(async function () {
	// right now its running the function a extra time - its not affecting the query so its fine for right now
	await classesController.checkExpiredClasses().catch(err => console.log(err));
	console.log("Hi");
}, 300000)
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
