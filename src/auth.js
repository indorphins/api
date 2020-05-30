const admin = require('firebase-admin');
const serviceAccount = require('../indo-e071f-firebase-adminsdk-ihibr-09411c503d.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://indo-e071f.firebaseio.com"
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
