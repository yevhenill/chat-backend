const { JSON } = require("sequelize");
const db = require("../models");
const md5 = require('md5');
const Tutor_contact = db.tutor_contact;
const User1 = db.user;
const Message = db.message

exports.uploadPorfileImg = async function (req, res, next) {
    // const history = await Tutor.findOne({ where: { email: req.body.email } });
    // await history.update({ image: req.file.path });
    res.send({ success: req.file.path })
}

exports.getAccount = async function (req, res, next) {
    const result = await User1.findOne({ where: { email: req.body.email } });
    res.send({ data: result })
}

exports.saveAccount = async function (req, res, next) {
    var update = {
        username: req.body.username,
        phone: req.body.phone,
        gender: req.body.gender,
        image: req.body.image
    }
    const result = await User1.findOne({ where: { email: req.body.email } });
    result.update(update);
    res.send({ flag: "success" })
}

exports.changeAccount = async function (req, res, next) {
    var update = {
        username: req.body.username,
        phone: req.body.phone,
        gender: req.body.gender,
        image: req.body.image
    }
    console.log(update)
    const result = await User1.findOne({ where: { email: req.body.email } });
    result.update(update);
    res.send({ flag: "success" })
}

exports.saveSchedule = async function (req, res, next) {
    const result = await User1.findOne({ where: { email: req.body.email } });
    result.update({ schedule: req.body.schedule });
    res.send({ flag: result })
}

exports.getSchedule = async function (req, res, next) {
    const result = await User1.findOne({ where: { email: req.body.email } });
    res.send({ data: result })
}

exports.saveUserSchedule = async function (req, res, next) {
    var contact = {
        email: req.body.email,
        tutor: req.body.tutor,
        schedule: req.body.schedule,
    }
    // console.log(contact)
    // return
    Tutor_contact.create(contact)
        .then(data => {
            res.send({ flag: "success" })
        })
        .catch(err => {
            console.log(err)
        });
}

exports.getMySchedule = async function (req, res, next) {
    await db.sequelize.query(`select a.tutor_contact_id, a.tutor, a.schedule, b.username from tutor_contacts a, users b where a.email = b.email and a.email = '${req.body.email}' `, { type: db.Sequelize.QueryTypes.SELECT })
        .then((result) => {
            res.send({ data: result });
        })
        .catch(err => {
            console.log(err)
        });
}

exports.deleteMySchedule = async function (req, res, next) {
    await db.sequelize.query(`DELETE FROM tutor_contacts WHERE tutor_contact_id = '${req.body.id}' `, { type: db.Sequelize.QueryTypes.SELECT })
        .then((result) => {
            console.log(result)
        })
        .catch(err => {
            console.log(err)
        });

    res.send({ flag: "success" });
}

exports.getTutorById = async function (req, res, next) {
    const check = await db.sequelize.query(`select * from messages where (email = "${req.body.email}" and emailTo = "${req.body.me}") or (email = "${req.body.me}" AND emailTo = "${req.body.email}")`,
        { type: db.Sequelize.QueryTypes.SELECT })

    if (check.length > 0) {
        res.send({ flag: "use" })
        return
    }

    await db.sequelize.query(`select * from users a, tutors b where a.email = b.email and b.tutor_id = '${req.body.id}' `, { type: db.Sequelize.QueryTypes.SELECT })
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




