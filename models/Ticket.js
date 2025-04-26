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
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
    },
    priorityHistory: [{
        priority: String,
        changedBy: String,
        timestamp: { type: Date, default: Date.now }
    }],
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
    }],
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    ratingHistory: [{
        rating: Number,
        userId: String,
        timestamp: { type: Date, default: Date.now }
    }],
    archived: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Ticket', ticketSchema); 