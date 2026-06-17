const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const NotificationLog = require('../models/NotificationLog');

// Initialize SendGrid if API key is set
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Sends an email or SMS notification and logs it in the database.
 * If credentials are not set, it performs a simulated delivery.
 */
async function sendAlert({ treeId, recipientName, recipientContact, deliveryType, title, message }) {
  const isEmail = deliveryType === 'email';
  let channel = 'Simulated';
  let status = 'simulated';
  let errorMsg = '';

  console.log(`[Notification Delivery] Initiating ${deliveryType} to ${recipientName} (${recipientContact})`);

  try {
    if (isEmail) {
      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        channel = 'SendGrid';
        const msg = {
          to: recipientContact,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: title,
          text: message,
          html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f766e; margin-top: 0;">Dravidian Family Tree</h2>
            <h3 style="color: #334155;">${title}</h3>
            <p style="font-size: 16px; line-height: 1.5; color: #475569;">${message}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from your family tree system.</p>
          </div>`
        };
        await sgMail.send(msg);
        status = 'sent';
        console.log(`[Notification Delivery] SendGrid email sent successfully to ${recipientContact}`);
      } else {
        console.log(`[Notification Delivery] SendGrid not configured. Simulating email send.`);
      }
    } else {
      // SMS
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
        channel = 'Twilio';
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `${title}\n\n${message}`,
          from: process.env.TWILIO_FROM_NUMBER,
          to: recipientContact
        });
        status = 'sent';
        console.log(`[Notification Delivery] Twilio SMS sent successfully to ${recipientContact}`);
      } else {
        console.log(`[Notification Delivery] Twilio not configured. Simulating SMS send.`);
      }
    }
  } catch (err) {
    status = 'failed';
    errorMsg = err.message;
    console.error(`[Notification Delivery] Error sending ${deliveryType}:`, err);
  }

  // Record the notification log in the database
  try {
    const log = await NotificationLog.create({
      treeId,
      recipientName,
      recipientContact,
      deliveryType,
      channel,
      status,
      title,
      message,
      error: errorMsg
    });
    return log;
  } catch (dbErr) {
    console.error('[Notification Delivery] Failed to write notification log to database:', dbErr);
  }
}

module.exports = {
  sendAlert
};
