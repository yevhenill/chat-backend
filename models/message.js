module.exports = (sequelize, Sequelize) => {
  const Message = sequelize.define("message", {
    message_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    senderID: {
      type: Sequelize.INTEGER,
    },
    message: {
      type: Sequelize.STRING,
    },
    roomId: {
      type: Sequelize.INTEGER,
    },
  });

  return Message;
};
