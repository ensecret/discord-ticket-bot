const mongoose = require('mongoose');
require('dotenv').config();
const Ticket = require('../models/Ticket');
const { logInfo } = require('./logger');

async function archiveOldTickets(days = 7) {
    await mongoose.connect(process.env.MONGODB_URI);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Ticket.updateMany(
        {
            status: 'closed',
            closedAt: { $lte: cutoff },
            archived: false
        },
        { $set: { archived: true } }
    );
    logInfo('Archive', `Архивировано тикетов: ${result.modifiedCount}`);
    await mongoose.disconnect();
}

if (require.main === module) {
    archiveOldTickets().then(() => process.exit(0));
}

module.exports = { archiveOldTickets }; 