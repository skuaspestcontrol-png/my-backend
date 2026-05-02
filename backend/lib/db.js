const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST,
  user: process.env.MYSQL_USER || process.env.DB_USER,
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Math.max(1, Number(process.env.MYSQL_CONNECTION_LIMIT || 5)),
  maxIdle: Math.max(1, Number(process.env.MYSQL_MAX_IDLE || 5)),
  idleTimeout: Number(process.env.MYSQL_IDLE_TIMEOUT || 60000),
  queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT || 0),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const globalKey = '__mysqlPool';
const globalStore = global;

const pool = globalStore[globalKey] || mysql.createPool(dbConfig);

if (process.env.NODE_ENV !== 'production') {
  globalStore[globalKey] = pool;
}

const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const getConnection = async () => pool.getConnection();

module.exports = {
  pool,
  query,
  getConnection,
};
