const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dailycoController = require('./controller/dailycoController');
const loginRouter = require('./routes/login');
const signupRouter = require('./routes/signup');
const profileRouter = require('./routes/profile');
const dailycoRouter = require('./routes/dailyco');
const https = require('https');
const fs = require('fs');

app.use(cors());
console.log('cors used');
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.options('*', cors()); // include before other routes

app.use('/', loginRouter);
app.use('/signup', signupRouter);
app.use('/profile', profileRouter);
app.use('/dailyco', dailycoRouter);

app.get('/healthy', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify({ status: `Active` }));
});

app.get('/dailco/room', dailycoController.getRoom, (req, res) => {
	console.log('router get room returns');
	res.status(200).send();
});

// TODO test this works
app.delete('/dailco/room', dailycoController.deleteRoom, (req, res) => {
	console.log('router delete room returns');
	res.status(200).send();
});

app.post('/dailco/room', dailycoController.createRoom, (req, res) => {
	console.log('router create room returns');
	res.status(200).send();
});

app.post('/dailco/token', dailycoController.createToken, (req, res) => {
	console.log('router create token returns');
	res.status(200).send();
});

// app.get('/build/bundle.js', (req, res) => {
// 	// res.status(200).sendFile(path.resolve(__dirname, '../build/bundle.js'));
// 	console.log('got bundle');
// 	res.status(200).send();
// });

const options = {
	key: fs.readFileSync('./certKeys/indorphins-2-godaddy-private.key'),
	cert: fs.readFileSync('./certKeys/indorphins-2.pem'),
};

https
	.createServer(options, app)
	.listen(PORT, () => console.log(`Listening on port ${PORT}`));
