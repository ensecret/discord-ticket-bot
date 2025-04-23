const mongoose = require('mongoose');

const ticketPanelSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    guildId: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TicketPanel', ticketPanelSchema); 