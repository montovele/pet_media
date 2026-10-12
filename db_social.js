// ./config/db_ct.js
import mysql from 'mysql2/promise';

export const poolCT = mysql.createPool({
  host: process.env.CT_DB_HOST||'localhost' ,
  user: process.env.CT_DB_USER||'root' ,
  password: process.env.CT_DB_PASS||'Metroman_1' ,
  database: process.env.CT_DB_NAME||'social_db',
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: 10,
});
export default poolCT;  