import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const to = 'Auchiplug@gmail.com';
const name = 'Auchiplug';

transporter.sendMail({
  from: process.env.EMAIL_FROM || '"EventConnect" <adogaeddie@gmail.com>',
  to,
  subject: 'Welcome to EventConnect! 🎉',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #2563eb;">Welcome to EventConnect, ${name}!</h2>
      <p>We're thrilled to have you join our community. Get ready to discover amazing events, connect with fellow attendees, and make the most out of your experiences.</p>
      <p>Here are a few things you can do to get started:</p>
      <ul>
        <li>Browse upcoming events and check in.</li>
        <li>Connect with other attendees.</li>
        <li>Share photos in the event feed.</li>
      </ul>
      <p>If you have any questions or need help, just reply to this email!</p>
      <p>Cheers,<br/>The EventConnect Team</p>
    </div>
  `,
}).then(info => console.log('Email sent:', info.response)).catch(err => console.error('Error:', err));
