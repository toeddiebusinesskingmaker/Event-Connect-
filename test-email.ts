import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
transporter.sendMail({
  from: process.env.EMAIL_FROM || '"EventConnect" <noreply@eventconnect.app>',
  to: process.env.SMTP_USER, // send to themselves for testing
  subject: 'Test Email from EventConnect',
  text: 'This is a test email to verify SMTP settings.'
}).then(info => console.log('Email sent:', info)).catch(err => console.error('Error:', err));
