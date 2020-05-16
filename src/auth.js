const admin = require('firebase-admin');
const serviceAccount = require('../groupfit-auth-firebase-adminsdk-ovr16-697a0631ce.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: 'https://groupfit-auth.firebaseio.com',
});

const verifyFirebaseToken = (req, res) => {
	// idToken comes from the client app, second boolean parameter is checkRevoked
	if (!req.headers.authorization) {
		throw Error('Request missing authorization bearer token');
	}
	const auth = req.headers.authorization.split(' ');
	if (auth.length < 2) {
		throw Error('Invalid authorization token format');
	}
	const token = auth[1];

	return admin
		.auth()
		.verifyIdToken(token, true)
		.then(function (decodedToken) {
			let uid = decodedToken.uid;
			console.log('Verified firebase token to uid: ', uid);
			return uid;
		})
		.catch(function (error) {
			console.log('userController - verifyFirebaseToken - error: ', error);
			throw error;
		});
};

function verifyToken(token) {
	return admin
		.auth()
		.verifyIdToken(token, true)
		.then(function (decodedToken) {
			return decodedToken;
		});
}

module.exports = {
	verifyFirebaseToken,
	verifyToken,
};
