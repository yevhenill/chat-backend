const dbConfig = require("../dbconnection");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  operatorsAliases: false,

  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle
  }
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.message = require("./message.js")(sequelize, Sequelize);
db.project = require("./project.js")(sequelize, Sequelize);
db.user = require("./user.js")(sequelize, Sequelize);
db.note = require("./note.js")(sequelize, Sequelize);

module.exports = sequelize;
module.exports = db;
