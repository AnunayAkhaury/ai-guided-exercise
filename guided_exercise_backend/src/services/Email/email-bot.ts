import nodemailer from 'nodemailer';

export async function sendEmail(to: string, content: string) {
  try {
    console.log('Sending Email');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_BOT_USER,
        pass: process.env.GOOGLE_APP_PASSWORD
      }
    });
    console.log('Create Transport Done');

    const info = await transporter.sendMail({
      from: process.env.EMAIL_BOT_USER,
      to: to,
      subject: 'Hello',
      text: content
    });

    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
