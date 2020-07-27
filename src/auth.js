const admin = require('firebase-admin');
const configString = process.env.FIREBASE_CONFIG;

async function init() {
	let serviceAccount;

	let buff = Buffer.from(configString, 'base64');
	let decoded = buff.toString('utf-8');
	serviceAccount = JSON.parse(decoded);

	return admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
	});
}

function verifyToken(token) {
	return admin.auth()
		.verifyIdToken(token, true)
		.then(function (decodedToken) {
			return decodedToken;
		});
}

async function verifyTokenSync(token) {
	return new Promise((done, reject) => {
		admin.auth()
			.verifyIdToken(token, true)
			.then(function (decodedToken) {
				done(decodedToken);
			})
			.catch(err => {
				reject(err);
			});
	})
}

module.exports = {
	init,
	verifyToken,
	verifyTokenSync,
};
