
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    name: String,
    surname: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const Client = mongoose.model('Client', clientSchema);
module.exports = Client;
