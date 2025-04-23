const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: String,
    channelId: String,
    messageId: String,
    userId: String,
    status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open'
    },
    category: { type: String, default: 'general' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdAt: {
        type: Date,
        default: Date.now
    },
    closedAt: Date,
    assignedTo: { type: String },
    messages: [{
        userId: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Ticket', ticketSchema); 