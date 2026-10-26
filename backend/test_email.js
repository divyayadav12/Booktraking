// Email Test Script - Run with: node test_email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('\n=== EMAIL CONFIG CHECK ===');
console.log('EMAIL_ENABLED:', process.env.EMAIL_ENABLED);
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? `SET (${process.env.SMTP_PASS.length} chars)` : 'NOT SET');
console.log('SMTP_FROM:', process.env.SMTP_FROM);
console.log('========================\n');

const missingOrPlaceholder = [];
if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('AAPKI')) missingOrPlaceholder.push('SMTP_USER (Gmail ID)');
if (!process.env.SMTP_PASS || process.env.SMTP_PASS.includes('AAPKA')) missingOrPlaceholder.push('SMTP_PASS (App Password)');

if (missingOrPlaceholder.length > 0) {
  console.error('❌ MISSING OR PLACEHOLDER VALUES in .env:');
  missingOrPlaceholder.forEach(m => console.error('   -', m));
  console.error('\n👉 .env file mein apni actual Gmail ID aur App Password daalo, phir dobara run karo.\n');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log('📡 SMTP se connect ho raha hai...');
transporter.verify()
  .then(() => {
    console.log('✅ SMTP connection SUCCESSFUL!\n');
    console.log('📧 Test email bhej raha hai...');
    return transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER, // apne aap ko hi test email
      subject: 'Test Email - Book Tracking System',
      html: `<h2>✅ Email setup successful!</h2><p>Yeh test email hai. Agar yeh aa rahi hai toh aapka email system ready hai.</p>`,
      text: 'Email setup successful! Book Tracking System se test email.',
    });
  })
  .then((info) => {
    console.log('✅ Test email BHEJ DI gayi!');
    console.log('   Message ID:', info.messageId);
    console.log('\n🎉 Ab Excel upload karo - email automatically jaayegi!\n');
  })
  .catch((err) => {
    console.error('❌ EMAIL ERROR:', err.message);
    console.error('\n--- TROUBLESHOOTING ---');
    if (err.message.includes('Invalid login') || err.message.includes('Username and Password')) {
      console.error('👉 Gmail App Password galat hai ya expire ho gaya.');
      console.error('   Gmail → Security → App Passwords → Naya password generate karo.');
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      console.error('👉 Internet connection ya SMTP host galat hai. Check karo: SMTP_HOST=smtp.gmail.com');
    } else if (err.message.includes('Less secure') || err.message.includes('Application-specific')) {
      console.error('👉 App Password use karo, normal Gmail password nahi.');
    }
    console.error('----------------------\n');
  });
