const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const router = require('./router');

const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// Get config vars
dotenv.config();
app.use(cors());

app.use(express.static('public'));
app.use('/public', express.static('public'));

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(router);

app.listen(process.env.BACKEND_PORT);
console.log('Server listening on:', process.env.BACKEND_PORT);


/******************************************************* File UPLOAD **************************************************/
const upload = require("express-fileupload");
const path = require("path");

app.use(upload());

// HTTP POST
app.post("/upload", function (request, response) {
  var images = new Array();
  if (request.files) {
    var arr;
    if (Array.isArray(request.files.filesfld)) {
      arr = request.files.filesfld;
    }
    else {
      arr = new Array(1);
      arr[0] = request.files.filesfld;
    }
    for (var i = 0; i < arr.length; i++) {
      var file = arr[i];
      images[i] = {
        name: "/" + file.name,
        type: file.mimetype.substring(0, 5).toLowerCase()
      }
      file.mv("./public" + images[i].name, function (err) {
        if (err) {
          console.log(err);
        }
      });
    }
  }
  // give the server a second to write the files
  setTimeout(function () { response.json(images); }, 1000);
});

/******************************************************* SOCKET *******************************************************/
const db = require("./models");
const Message = db.message
const Project = db.project
const User = db.user
const { Op } = require('sequelize');

var users = [];

// Error handling
http.on('error', (err) => {
  console.error('Server error:', err);
  io.close(); // Close the socket server

  // Emit an error event to connected clients
  io.sockets.emit('serverError', {
    message: 'Server stopped due to an error',
  });
});

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('disconnect', () => {
    deleteUserById(socket.id)
  });

  socket.on('createRoom', function (data) {
    socket.join(data.roomId);
  });

  socket.on('initial', async function (data) {
    addUser({ user: data.userID })
    const userlist = await sendUserstatus();
    io.sockets.emit('initial', { status: userlist });
  })

  socket.on('addMessage', (data) => {
    io.to(data.data.roomId).emit('addMessage', data.data);
  });

  socket.on('updateUserList', async (data) => {
    // Get the all users in the current room
    // var roomusers = await db.sequelize.query(
    //   `SELECT * FROM projects WHERE roomID = ${data.roomId}`, { type: db.Sequelize.QueryTypes.SELECT })
    const roomusers = await Project.findAll({ where: { roomID: data.roomId } });

    roomusers = roomusers[0]

    var guests = JSON.parse(roomusers.guests).map(obj => obj.id);
    guests = guests.join(', ');
    // var userlist = await db.sequelize.query(
    //   `SELECT * FROM users WHERE id = ${roomusers.sender} OR id = ${roomusers.reciever} OR id IN (${guests})`, { type: db.Sequelize.QueryTypes.SELECT })
    const userlist = await User.findAll({
      where: {
        id: {
          [Sequelize.Op.or]: [roomusers.sender, roomusers.receiver],
          [Sequelize.Op.in]: guests
        }
      }
    });

    for (let i = 0; i < userlist.length; i++) {
      if (userlist[i].id == roomusers.sender) {
        userlist[i].permission = 'Owner';
      }
      if (userlist[i].id == roomusers.reciever) {
        userlist[i].permission = 'Admin';
      }
      if (userlist[i].id != roomusers.sender && userlist[i].id != roomusers.reciever) {
        var temp = JSON.parse(roomusers.guests);
        temp.map((val) => {
          if (userlist[i].id == val.id) {
            userlist[i].permission = val.role ? 'Owner' : 'Admin';
          }
        })
      }
    }
    io.to(data.roomId).emit('updateUserList', userlist);
  });

  socket.on('addMessage2', async (data) => {
    /******  params *********
    *  userID
    *  message
    *  roomId
    *  type
    *************************/

    // Add unread count
    let allusers = []; // All users in the room
    var project = await Project.findOne({ where: { roomID: data.roomId } });
    var userInfo = await User.findOne({ where: { id: data.userID } })

    allusers.push(project.sender)
    allusers.push(project.reciever)
    if (project.guests) {
      JSON.parse(project.guests).map((val) => {
        allusers.push(val.id)
      })
    }

    /******************* Start unread update *******************/
    var update = {}, unread = [];
    unread = project.unread ? JSON.parse(project.unread) : [];


    var results = {};
    if (!project.unread) {
      // find new invited user
      let addtionalUser = allusers.filter((item1) => {
        return !unread.some((item2) => item2.id === item1);
      });

      // Add the new user to the unread
      addtionalUser.map((val) => {
        unread.push({ id: val, val: 1 })
      })

      unread.map((val, i) => {
        results[parseInt(val.id)] = unread;
      })

      results = Object.entries(results).map(function ([key, value]) {
        return { [key]: value };
      });
    }
    else {
      unread = unread.map(function (obj) {
        var newObj = {};
        for (var key in obj) {
          newObj[key] = obj[key].map(function (item) {
            if (key != data.userID) {
              item.val++;
            }
            return item;
          });
        }
        return newObj;
      });

      var result = allusers.filter(value => {
        for (var i = 0; i < unread.length; i++) {
          var key = Object.keys(unread[i])[0];
          if (key === value.toString()) {
            return false;
          }
        }
        return true;
      });

      var keyToRetrieve = Object.keys(unread[0])[0]; // Retrieve the key dynamically

      for (var i = 0; i < result.length; i++) {
        var newObj = {};
        var key = result[i].toString();
        newObj[key] = unread[0][keyToRetrieve].map(function (obj) {
          return { id: obj.id, val: 1 };
        });
        unread.push(newObj);
      }

      for (var i = 0; i < unread.length; i++) {
        for (var j = 0; j < result.length; j++) {
          var newObj = { id: result[j].toString(), val: 1 };
          unread[i][Object.keys(unread[i])[0]].push(newObj);
        }
      }
      results = unread;
    }

    update.unread = JSON.stringify(results);
    await project.update(update);
    /******************* End unread update ***********************/

    // Message filter
    var message = data.message;
    var visibility = 1;
    if (data.type && data.type == 'invite') {
      message = `<i>${userInfo.username}Invited <b>${data.message}</b> to this chat room.</i>`;
      visibility = 0;
    }
    else if (data.type && data.type == 'tag') {
      const tagUser = await User.findOne({ where: { username: data.message } })
      message = `<i>${userInfo.username} tagged <b>${tagUser.username}</b></i>`
    }

    var message_id = await db.sequelize.query(`SELECT LAST_INSERT_ID() as id1`, { type: db.Sequelize.QueryTypes.SELECT })
    message_id = message_id[0].id1


    io.to(data.roomId).emit('addMessage2', {
      username: userInfo.username,
      message_id: message_id,
      message: message,
      senderName: userInfo.username,
      visibility: visibility,
      createdAt: getLocalDateTime(),
      updatedAt: getLocalDateTime(),
      image: userInfo.image
    });

    io.sockets.emit('updateRoomList', { roomId: data.roomId });

    var inputData = {
      senderID: data.userID,
      message: message,
      roomId: data.roomId,
      visibility: visibility,
    }

    Message.create(inputData)
  });

  socket.on('readMessage', async (data) => {
    /******  params *********
    *    userID: userID,    // User ID
    *    roomID: room_id,   // Room ID,
    *    otherID: user_id   // other's ID
    *************************/
    const project = await Project.findOne({ where: { roomID: data.roomID } });
    if (project.unread) {
      var guests = JSON.parse(project.unread)

      var fist = 0; second = 0;
      guests.map((val, i) => {
        var key = Object.keys(val)[0];
        if (key == data.userID) {
          fist = i;
          val[key].map((t, j) => {
            if (t.id == data.otherID) {
              second = j
            }
          })
        }
      })

      guests[fist][data.userID][second].val = 0;
      guests = JSON.stringify(guests);

      var newUpdate = {}
      newUpdate.unread = (guests);
      await project.update(newUpdate);
    }
  });

  socket.on('editMessage', (data) => {
    io.to(data.roomId).emit('editMessage', data);
  });

  socket.on('updateAsOnline', (data) => {
    updateAsOnline()
  });

  socket.on('deleteMessage', (data) => {
    io.to(data.roomId).emit('deleteMessage', data);
  });

  socket.on('sendingInvitaion', (data) => {
    io.sockets.emit('sendingInvitaion', data);
  });

  function addUser(user) {
    const index = users.findIndex(u => u.user === user.user);
    if (index === -1) {
      // User is not in array, add them
      user.id = socket.id;
      user.status = 1;
      user.time = new Date();
      users.push(user);
    }
  }

  function deleteUserById(id) {
    // Check if user is in array
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      // User is in array, remove them
      users.splice(index, 1);
    }
  }

  function updateStatus() {
    const now = new Date();
    const cutoff = new Date(now - 5 * 60 * 1000); // Calculate cutoff time (5 minutes ago)

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const time = new Date(user.time);
      if (time < cutoff) {
        user.status = 2; // Update status to 2 if time difference is over 5 minutes
      }
    }
  }

  function updateAsOnline() {
    users.map((val, i) => {
      const now = new Date();
      if (val.id == socket.id) {
        users[i].status = 1;
        users[i].time = now
      }
    })
    io.sockets.emit('updateAsOnline', users);
  }


  async function sendUserstatus() {
    const user = users.find(u => u.id === socket.id); // Find user using ID
    if (user) {
      // const list = await db.sequelize.query(
      //   `SELECT sender, reciever FROM projects WHERE sender = ${user.user} OR reciever = ${user.user}`,
      //   { type: db.Sequelize.QueryTypes.SELECT })
      const list = await Project.findAll({
        attributes: ['sender', 'reciever'],
        where: {
          [Op.or]: [
            { sender: user.user },
            { reciever: user.user }
          ]
        }
      });

      // Get all users related to the user
      const senders = Array.from(new Set(list.map(c => c.sender))); // Get unique senders
      const receivers = Array.from(new Set(list.map(c => c.reciever))); // Get unique receivers
      const allUsers = Array.from(new Set([...senders, ...receivers])); // Merge unique senders and receivers

      // Get all user status inclued to the user
      const userlist = users.filter(a => allUsers.includes(a.user));

      const result = allUsers.map(user => {
        const foundUser = userlist.find(u => u.user === user);
        return foundUser ? { user: foundUser.user, status: foundUser.status } : { user, status: 0 };
      });

      return result;
    }
  }

  setInterval(() => {
    updateStatus();
  }, 5 * 60 * 1000);

  function getLocalDateTime() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours() % 12 || 12;
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const date = `${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    const time = `${hours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;
    const formattedDateTime = `${date} ${time}`;
    return formattedDateTime
  }
});

http.listen(process.env.SOCKET_PORT, () => console.log(`Socket Server has started on ${process.env.SOCKET_PORT}.`));


