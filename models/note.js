module.exports = (sequelize, Sequelize) => {
  const Note = sequelize.define("note", {
    note_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userID: {
      type: Sequelize.INTEGER,
    },
    content: {
      type: Sequelize.STRING,
    },
  });

  return Note;
};
