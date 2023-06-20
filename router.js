
const router = require('express').Router();
const Chat = require('./controllers/chat')

// // Chat 
router.post('/saveMessage', Chat.saveMessage);
router.post('/getmessage', Chat.getMessages);
router.post('/getchatlist', Chat.getChatList);
router.post('/readallmessages', Chat.readallmessages);
router.post('/deleteMessageById', Chat.deleteMessageById);
router.post('/editMessageById', Chat.editMessageById);
router.post('/searchMessage', Chat.searchMessage);
router.post('/searchPeopleForInvite', Chat.searchPeopleForInvite);
router.post('/invitepeople', Chat.invitepeople);
router.post('/taguser', Chat.taguser);
router.post('/saveNote', Chat.saveNote);
router.post('/getNote', Chat.getNote);
router.post('/changeUserpermission', Chat.changeUserpermission);
router.post('/searchfilelink', Chat.searchfilelink);
router.post('/searchtaggeduser', Chat.searchtaggeduser);

module.exports = router;