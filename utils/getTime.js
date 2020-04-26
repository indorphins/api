exports.getTime = () => {
	var mySqlTimestamp = Date.now();
	var date = new Date(mySqlTimestamp);
	return date;
};
