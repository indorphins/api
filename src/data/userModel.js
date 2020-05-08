const { Pool } = require('pg');
// db URI
const PG_URI = 'postgres://vogevbto:CzupjdSeT8NNNL5hCamhOL2bx7fuUHH_@drona.db.elephantsql.com:5432/vogevbto';

const pool = new Pool({
    connectionString: PG_URI
});


module.exports = {
    query: (text, params, callback) => {
        console.log('exeuted query', text);
        return pool.query(text, params, callback);
    }
};

// table query 
// CREATE TABLE users (
// 	user_id serial NOT NULL UNIQUE,
// 	created_at TIMESTAMP(255) NOT NULL,
// 	first_name varchar(16) NOT NULL,
// 	last_name varchar(16) NOT NULL,
// 	email varchar(255) NOT NULL,
// 	phone_number character(10) NOT NULL,
// 	password varchar(255) NOT NULL,
// 	user_type character(10) NOT NULL
// ) WITH (
//   OIDS=FALSE
// );




