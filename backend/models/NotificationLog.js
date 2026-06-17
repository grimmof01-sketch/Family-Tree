const mongoose = require('mongoose');

const NotificationLogSchema = new mongoose.Schema({
  treeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tree',
    default: null
  },
  recipientName: {
    type: String,
    required: true
  },
  recipientContact: {
    type: String,
    required: true
  },
  deliveryType: {
    type: String,
    enum: ['email', 'sms'],
    required: true
  },
  channel: {
    type: String,
    enum: ['Twilio', 'SendGrid', 'Simulated'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'simulated', 'failed'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  error: {
    type: String,
    default: ''
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NotificationLog', NotificationLogSchema);
