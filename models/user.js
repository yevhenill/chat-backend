module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("user", {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    email: {
      type: Sequelize.STRING,
    },
    image: {
      type: Sequelize.STRING,
    },
    username: {
      type: Sequelize.STRING,
    },
  });

  return User;
};
