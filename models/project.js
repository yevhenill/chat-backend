module.exports = (sequelize, Sequelize) => {
  const Project = sequelize.define("project", {
    project_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    project_title: {
      type: Sequelize.STRING,
    },
    guests: {
      type: Sequelize.STRING,
    },
    sender: {
      type: Sequelize.STRING,
    },
    reciever: {
      type: Sequelize.STRING,
    },
    block: {
      type: Sequelize.STRING,
    },
    unread: {
      type: Sequelize.STRING,
    },
    roomID: {
      type: Sequelize.INTEGER,
    },
  });

  return Project;
};
