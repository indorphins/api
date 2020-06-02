const admin = require('firebase-admin');
const configString = process.env.FIREBASE_CONFIG;

let serviceAccount;

if (configString.charAt(0) === "'") {
	serviceAccount = JSON.parse(configString.replace("'", ""));
} else {
	serviceAccount = JSON.parse(configString);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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
