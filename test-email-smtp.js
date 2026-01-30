const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
    debug: true, // Enable debug output
    logger: true  // Log to console
});

async function testConnection() {
    console.log("Testing SMTP connection with settings:");
    console.log(`Host: ${process.env.EMAIL_HOST}`);
    console.log(`Port: ${process.env.EMAIL_PORT}`);
    console.log(`User: ${process.env.EMAIL_USER}`);

    try {
        await transporter.verify();
        console.log("✅ SMTP connection verified!");
    } catch (error) {
        console.error("❌ SMTP verification failed:", error.message);
        console.error("Full error:", error);
    }
}

testConnection();
