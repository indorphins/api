const admin = require('firebase-admin');
const serviceAccount = require('../groupfit-auth-firebase-adminsdk-ovr16-697a0631ce.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: 'https://groupfit-auth.firebaseio.com',
});

function verifyToken(token) {
	return admin
		.auth()
		.verifyIdToken(token, true)
		.then(function (decodedToken) {
			return decodedToken;
		});
}

module.exports = {
	verifyToken,
};
