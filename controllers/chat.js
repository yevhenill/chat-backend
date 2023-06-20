const db = require("../models");
const Message = db.message;
const User = db.user;
const Note = db.note;
const Project = db.project;
const { Op } = require('sequelize');
const { QueryTypes } = require('sequelize');

exports.getMessages = async function (req, res, next) {
	// Get the Room list
	var roomList = await db.sequelize.query(
		`SELECT * FROM 
		(SELECT ROW_NUMBER() OVER (PARTITION BY m.roomId ORDER BY m.message_id DESC) AS rn, m.*, p.block, p.sender, p.unread, p.project_title, u.username AS senderName, u.image AS senderImage, u.email AS senderEmail FROM 
		  ( SELECT * FROM projects WHERE sender = ${req.body.userID} OR reciever = ${req.body.userID} OR guests LIKE '%"${req.body.userID}"%') p, 
			messages AS m, 
			users AS u 
			WHERE p.roomID = m.roomId AND p.sender = u.id) AS t1,
		(SELECT ROW_NUMBER() OVER (PARTITION BY m.roomId ORDER BY m.message_id DESC) AS rn, m.*, p.block, p.reciever, p.unread, p.project_title, u.username AS receiverName, u.image AS receiverImage, u.email AS receiverEmail FROM 
		  ( SELECT * FROM projects WHERE sender = ${req.body.userID} OR reciever = ${req.body.userID} OR guests LIKE '%"${req.body.userID}"%') p, 
			messages AS m, 
			users AS u 
			WHERE p.roomID = m.roomId AND p.reciever = u.id) AS t2
		 WHERE t1.message_id = t2.message_id AND t1.rn = 1 ORDER BY t1.message_id DESC`, { type: db.Sequelize.QueryTypes.SELECT })

	// Get the all messages in the current room
	var currentRoom = req.body.roomId == 0 ? roomList[0].roomId : req.body.roomId;
	var message = await db.sequelize.query(
		`SELECT m.message, m.message_id, m.roomId, m.senderID, m.visibility, m.createdAt, m.updatedAt, u.username, u.email, u.image FROM messages m, users u WHERE m.roomId = ${currentRoom} AND m.senderID = u.id ORDER BY m.message_id DESC`, { type: db.Sequelize.QueryTypes.SELECT })

	// Get the all users in the current room
	var roomusers = await db.sequelize.query(
		`SELECT * FROM projects WHERE roomID = ${currentRoom}`, { type: db.Sequelize.QueryTypes.SELECT })
	roomusers = roomusers[0]

	var guests;
	if (roomusers.guests) {
		guests = JSON.parse(roomusers.guests).map(obj => obj.id);
		guests = guests.join(', ');
	}
	else {
		guests = '-1'
	}

	var userlist = await db.sequelize.query(
		`SELECT * FROM users WHERE id = ${roomusers.sender} OR id = ${roomusers.reciever} OR id IN (${guests})`, { type: db.Sequelize.QueryTypes.SELECT })

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
					userlist[i].permission = val.role ? 'Admin' : 'Member';
				}
			})
		}
	}

	res.send({ flag: "success", message: message, roomList: roomList, userlist: userlist });
}

exports.getChatList = async function (req, res, next) {
	await db.sequelize.query(
		`SELECT * FROM messages WHERE (sender = "${req.body.me}" AND receiver = "${req.body.email}") OR sender = "${req.body.email}" AND receiver = "${req.body.me}" ORDER BY createdAt`,
		{ type: db.Sequelize.QueryTypes.SELECT })
		.then((result) => {
			if (!result) {
				res.send({ flag: "no" });
				return
			}
			res.send({ flag: "success", data: result });
		})
		.catch(err => {
			console.log(err)
		});
}


// Search message for invitation
exports.searchPeopleForInvite = async function (req, res, next) {
	await db.sequelize.query(
		`SELECT id, username FROM users WHERE id !=  (SELECT sender FROM projects WHERE roomID = ${req.body.roomId}) AND id !=  (SELECT reciever FROM projects WHERE roomID = ${req.body.roomId})`,
		{ type: db.Sequelize.QueryTypes.SELECT })
		.then((result) => {
			res.send({ result: result })
		})
		.catch(err => {
			console.log(err)
		});
}

// Save new message
exports.saveMessage = async function (req, res, next) {
	const roomInfo = await Message.findOne({ where: { roomId: req.body.roomId } });

	var message = {
		senderID: req.body.sender,
		message: req.body.message,
		roomId: req.body.roomId,
		unread: 1
	}

	await Message.create(message)
	var message_id = await db.sequelize.query(`SELECT LAST_INSERT_ID() as id1`, { type: db.Sequelize.QueryTypes.SELECT })
	var messageInfo = await db.sequelize.query(
		`SELECT m.message, m.createdAt, m.updatedAt, u.image, u.username FROM messages m, users u WHERE m.message_id = ${message_id[0].id1} AND m.senderID = u.id`,
		{ type: db.Sequelize.QueryTypes.SELECT })

	messageInfo = messageInfo[0];
	res.send({
		flag: "success",
		message_id: message_id[0].id1,
		createdAt: messageInfo.createdAt,
		updatedAt: messageInfo.updatedAt,
		message: messageInfo.message,
		username: messageInfo.username,
		image: messageInfo.image,
	})

}

exports.deleteMessageById = async function (req, res, next) {
	// await db.sequelize.query(`UPDATE messages SET visibility = 0 WHERE message_id = ${req.body.id} `)
	await db.sequelize.query(
		'UPDATE messages SET visibility = 0 WHERE message_id = :id',
		{
			replacements: { id: req.body.id },
			type: QueryTypes.UPDATE,
		}
	);
	res.send({ flag: "success" });
}

exports.editMessageById = async function (req, res, next) {
	var update = {}
	const message = await Message.findOne({ where: { message_id: req.body.message_id } })
	update.message = req.body.message;
	message.update(update);
	res.send({ flag: "success" });
}

exports.readallmessages = async function (req, res, next) {
	// await db.sequelize.query(`UPDATE messages SET unread = 0 WHERE email = "${req.body.email}" AND emailTo = "${req.body.me}" `)
	await db.sequelize.query(
		'UPDATE messages SET unread = 0 WHERE email = :email AND emailTo = :me',
		{
			replacements: { email: req.body.email, me: req.body.me },
			type: QueryTypes.UPDATE,
		}
	);
}

exports.searchtaggeduser = async function (req, res, next) {
	const user = await Project.findAll({
		where: {
			[Op.or]: [
				{ sender: req.body.userID },
				{ reciever: req.body.userID }
			]
		}
	});

	var userList = []
	user.forEach(val => {
		userList.push(val.sender);
		userList.push(val.reciever)
	});

	userList = userList.filter((value, index, self) => {
		return self.indexOf(value) === index;
	});

	const result = await User.findAll({
		where: {
			id: {
				[Op.in]: userList
			},
			username: {
				[Op.like]: `%${req.body.search}%`
			}
		}
	});

	res.send({ result: result })

}

exports.searchMessage = async function (req, res, next) {
	try {
		const search = req.body.search;
		const roomId = req.body.roomId;

		const query = `
		SELECT m.message_id, m.message, m.senderID, u.username, u.image, m.createdAt, m.updatedAt
		FROM (
		  SELECT message_id, senderID, createdAt, updatedAt,
			TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
			  message, '<span>', ' '), '</span>', ' '), '<p>', ' '), '</p>', ' '), '<br>', ' '), '<br/>', ' '), '<br />', ' '), '<div>', ''), '</div>', '')
			) AS message
		  FROM messages
		  WHERE message LIKE :searchTerm
			AND message NOT LIKE '%<img%'
			AND roomId = :roomId
		) m, users u
		WHERE m.senderID = u.id
	  `;

		const result = await db.sequelize.query(query, {
			type: db.Sequelize.QueryTypes.SELECT,
			replacements: { searchTerm: `%${search}%`, roomId: roomId }
		});

		res.send({ result: result });
	} catch (error) {
		next(error);
	}
};


// Search File & Links for invitation
exports.searchfilelink = async function (req, res, next) {
	var search1 = '', search2 = '';
	if (req.body.flag == 1) { // All 
		search1 = 'onclick="downloaddFile'
		search2 = 'class="preview-image"'
	}
	else if (req.body.flag == 2) { // Files
		search1 = 'onclick="downloaddFile'
		search2 = ''
	}
	else if (req.body.flag == 3) { // Links
		search1 = ''
		search2 = 'class="preview-image"'
	}

	if (req.body.flag == 1) {
		var result = await db.sequelize.query(`SELECT m.message_id, m.message, m.senderID, u.username, u.image, m.createdAt, m.updatedAt FROM ( 
			SELECT message_id, senderID, createdAt, updatedAt, TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
			message,  '<span>', ' '), '</span>', ' '), '<p>', ' '), '</p>', ' '), '<br>', ' '), '<br/>', ' '), '<br />', ' '), '<div>', ''), '</div>', '')
			) AS message FROM messages WHERE (message LIKE '%${search1}%' or message LIKE '%${search2}%') AND message LIKE '%${req.body.search}%' AND roomId = ${req.body.roomId} ) m, users u 
			WHERE m.senderID = u.id`, { type: db.Sequelize.QueryTypes.SELECT })
	}
	else {
		var result = await db.sequelize.query(`SELECT m.message_id, m.message, m.senderID, u.username, u.image, m.createdAt, m.updatedAt FROM ( 
			SELECT message_id, senderID, createdAt, updatedAt, TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
			message,  '<span>', ' '), '</span>', ' '), '<p>', ' '), '</p>', ' '), '<br>', ' '), '<br/>', ' '), '<br />', ' '), '<div>', ''), '</div>', '')
			) AS message FROM messages WHERE (message LIKE '%${search1}%' AND message LIKE '%${search2}%') AND message LIKE '%${req.body.search}%' AND roomId = ${req.body.roomId} ) m, users u 
			WHERE m.senderID = u.id`, { type: db.Sequelize.QueryTypes.SELECT })
	}

	res.send({ result: result });
}

exports.getNote = async function (req, res, next) {
	/******  params *********
   *    userID
   *************************/
	const note = await Note.findOne({ where: { userID: req.body.userID } });
	var noteValue = ''
	if (note) {
		noteValue = note.content;
	}
	res.send({ note: noteValue })
}

exports.saveNote = async function (req, res, next) {
	/******  params *********
   *    userID
   *    note
   *************************/
	const note = await Note.findOne({ where: { userID: req.body.userID } });
	var update = {}
	if (!note) {
		update = {
			userID: req.body.userID,
			note: JSON.stringify(req.body.note)
		}
		Note.create(update);
	}
	else {
		update.content = JSON.stringify(req.body.note);
		note.update(update);
	}
}


exports.changeUserpermission = async function (req, res, next) {
	/******  params *********
	 *  userID				// user ID
	 *  username            // Sender username
	 * 	roomId              // RoomID
	 * 	flag 
	*************************/
	const kickMessage = `You can't kick this user.`;
	const ownerMessage = `This user is owner of this room. You can't block this user.`
	const nopermissionMessage = `You do not have permission to block this user.`

	const user = await User.findOne({ where: { username: req.body.username } });
	if (user.id == req.body.userID) {
		// exit if the blocked user is you
		res.send({ result: kickMessage })
		return
	}
	var update = {};
	const project = await Project.findOne({ where: { roomID: req.body.roomId } });
	if (req.body.flag == 'kick') {
		var removeArray = [];
		if (project.guests) {
			update.guests = JSON.parse(project.guests);
			update.guests.map((val) => {
				if (val.id == user.id) {
					removeArray.push(val.id);
				}
			})

			if (removeArray.length > 0) {
				// Remove the kick user in the guest
				update.guests = update.guests.filter(function (obj) {
					return !removeArray.includes(obj.id);
				});
				if (update.guests.length == 0) {
					update.guests = ''
				}
				else {
					update.guests = JSON.stringify(update.guests)
				}
				project.update(update)
				res.send({ result: 'success' })
			}
			else {
				res.send({ result: kickMessage })
			}
		}
		else {
			res.send({ result: kickMessage })
		}
	}
	else if (req.body.flag == 'block') {
		var blocklist = []
		blocklist.push(user.id)
		if (user.id == project.sender) {
			res.send({ result: ownerMessage })
		}
		else {
			if (!project.block) {
				update.block = JSON.stringify(blocklist);
				project.update(update);
				res.send({ result: 'success' })
			}
			else {
				var changeable = false;
				if (req.body.userID == project.sender || req.body.userID == project.reciever) {
					changeable = true;
				}
				if (project.guests) {
					JSON.parse(project.guests).map((val) => {
						if (req.body.userID == val.id && val.val == true) {
							changeable = true;
						}
					})
				}

				// check the permission
				if (changeable) {
					update.block = JSON.parse(project.block);
					if (update.block.includes(user.id)) {
						update.block = update.block.filter(function (value) {
							return value !== user.id;
						});
						if (update.block.length > 0) {
							update.block = JSON.stringify(update.block);
						}
						else {
							update.block = '';
						}
						project.update(update);
						res.send({ result: 'success' })
					}
					else {
						update.block.push(user.id);
						update.block = JSON.stringify(update.block);
						project.update(update);
						res.send({ result: 'success' })
					}
				}
				else {
					res.send({ result: nopermissionMessage })
				}
			}
		}
	}
}

exports.invitepeople = async function (req, res, next) {
	var params = []
	req.body.value.map((value) => {
		params.push({ id: value, role: req.body.role })
	})

	var invitedGuests = await db.sequelize.query(`SELECT guests FROM projects WHERE roomID = ${req.body.roomId}`, { type: db.Sequelize.QueryTypes.SELECT })
	if (!invitedGuests[0].guests) {
		await db.sequelize.query(`UPDATE projects SET guests = '${JSON.stringify(params)}' WHERE roomID = "${req.body.roomId}" `)
		const idString = params.map(obj => `'${obj.id}'`).join(', ');
		const ids = params.map(item => item.id); // Get all IDs of invited users
		var results = await db.sequelize.query(`SELECT * FROM users WHERE id IN (${idString})`, { type: db.Sequelize.QueryTypes.SELECT })
		res.send({ value: results, ids: ids })
	}
	else {
		invitedGuests = JSON.parse(invitedGuests[0].guests);
		var mergedArray = invitedGuests.concat(params).filter((obj, index, self) => {
			return index === self.findIndex(t => t.id === obj.id);
		});
		const difference = params.filter(obj => !invitedGuests.some(t => t.id === obj.id));
		await db.sequelize.query(`UPDATE projects SET guests = '${JSON.stringify(mergedArray)}' WHERE roomID = "${req.body.roomId}" `)
		var idString = difference.map(obj => `'${obj.id}'`).join(', ');
		const ids = difference.map(item => item.id); // Get all IDs of invited users
		if (idString.length > 0) {
			var results = await db.sequelize.query(`SELECT * FROM users WHERE id IN (${idString})`, { type: db.Sequelize.QueryTypes.SELECT })
			res.send({ value: results, ids: ids })
		}
		else {
			res.send({ value: [], ids: [] })
		}
	}
}

/************************************************************* TAG API ***********************************************************/
exports.taguser = async function (req, res, next) {
	console.log(req.body, removeTags(req.body.message), req.body.tagsearchUsersId)
	// if req.body.taggedUserId is 0, send SMS to room members

	res.send(req.body)
	/*
	*  req.body.userID            Sender UserID
	*  req.body.taggedUserId      Tagged UserID
	*  req.body.roomId            roomId
	*  req.body.message           message
	*  tagsearchUsersId           Everyone: If the taggedUserId = -1
	*                           ------------------    CASE   ---------------------
	*       taggedUserId is -1:  this is the case that send SMS to the all users. At this time, user list is tagsearchUsersId 
	*       taggedUserId is 0:   This the case that send SMS to the all users of room. 
	*
	*  Sender & Tagged UserID match the "id" in users table
	*  const userInfo = await User.findOne({ where: { id: req.body.userID } })   :GET USER INFOMATION CODE
	*/
}
/************************************************************* TAG API ***********************************************************/

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

function removeTags(str) {
	if ((str === null) || (str === ''))
		return false;
	else
		str = str.toString();
	return str.replace(/<[^>]*>/g, '');
}




