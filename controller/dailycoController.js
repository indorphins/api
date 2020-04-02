//TODO move this to server side
const fetch = require('node-fetch');
const url = require('url');
const dailyCoUrl = 'https://api.daily.co';
const DAILY_CO_API_KEY =
	'C9dc8ed6d58c6e656319cd7bb105f36057c598d3d8d613adc14344c6b7a4cb7c';

// Takes in properties in body, create room properties are { name: '', privacy: '', properties: {} }
async function createRoom(req, res) {
	console.log('START CREATE ROOM SERVER');
	try {
		console.log('Create room req body is ', req.body);
		const target = dailyCoUrl + '/v1/rooms';
		const body = req.body;

		const options = {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${DAILY_CO_API_KEY}`
			},
			body: JSON.stringify(body)
		};

		const response = await fetch(target, options);
		const json = await response.json();
		res.status(200).json(json);
	} catch (e) {
		console.log('createRoom error: ', e);
		res.status(400).send(e);
	}
}

// get room by name, must pass url parameter name else error returned
async function getRoom(req, res) {
	try {
		console.log('get room req url is ', req.url);
		const queryObject = url.parse(req.url, true).query;
		console.log('query obj is ', queryObject);
		if (!queryObject.name) {
			throw new Error("Missing parameter 'name' in url");
		}
		const target = dailyCoUrl + '/v1/rooms/' + queryObject.name;

		const options = {
			method: 'GET',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${DAILY_CO_API_KEY}`
			}
		};

		const response = await fetch(target, options);
		const json = await response.json();
		res.status(200).json(json);
	} catch (e) {
		console.log('getRoom error: ', e);
		throw new Error(e);
	}
}

// Delete room
async function deleteRoom(req, res) {
	try {
		console.log('delete room req.url is ', req.url);
		const queryObject = url.parse(req.url, true).query;
		console.log('query obj is ', queryObject);
		if (!queryObject.name) {
			throw new Error("Missing parameter 'name' in url");
		}
		const target = dailyCoUrl + '/v1/rooms/' + queryObject.name;

		const options = {
			method: 'DELETE',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${DAILY_CO_API_KEY}`
			}
		};

		const response = await fetch(target, options);
		const json = await response.json();
		res.status(200).json(json);
	} catch (e) {
		console.log('deleteRoom error: ', e);
		throw new Error(e);
	}
}

// create a token with input properties
async function createToken(req, res) {
	try {
		console.log('Create token req body is ', req.body);
		const target = dailyCoUrl + '/v1/meeting-tokens';
		const body = req.body;

		const options = {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${DAILY_CO_API_KEY}`
			},
			body: JSON.stringify(body)
		};

		console.log('create token options are ', options);
		const response = await fetch(target, options);
		const json = await response.json();
		res.status(200).json(json);
	} catch (e) {
		console.log('createToken error: ', e);
		throw new Error(e);
	}
}

module.exports = {
	createRoom: createRoom,
	deleteRoom: deleteRoom,
	getRoom: getRoom,
	createToken: createToken
};
