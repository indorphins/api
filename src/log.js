const bunyan = require('bunyan');
const bformat = require('bunyan-format');
const process = require('process');

var LOG_LEVEL = 30;
var OUTPUT = 'json';

if (process.env.LOG_LEVEL == "debug") {
	LOG_LEVEL = 20;
	OUTPUT = 'short'
}

const log = bunyan.createLogger({
	name: "indorphins",
	serializers: {
		err: bunyan.stdSerializers.err,
		req: bunyan.stdSerializers.req,
		res: bunyan.stdSerializers.res
	},
	level: LOG_LEVEL, 
	stream: bformat({ 
		outputMode: OUTPUT,
		levelInString: true 
	})
});

module.exports = log;
