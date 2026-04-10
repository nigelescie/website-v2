const nodemailer = require('nodemailer');

// Diagnostic Logs for environment variables (obfuscated)
console.log('🔍 Email Service Check:');
console.log(`- EMAIL_SERVICE: ${process.env.EMAIL_SERVICE || 'not set (using default)'}`);
console.log(`- EMAIL_USER: ${process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}...` : 'MISSING'}`);
console.log(`- EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? 'PRESENT (hidden)' : 'MISSING'}`);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    // Very high timeouts for cloud environments
    connectionTimeout: 60000, // 60s
    greetingTimeout: 60000,
    socketTimeout: 60000,
    tls: {
        rejectUnauthorized: false // Helps with some cloud proxy certificates
    }
});

// Verify transporter on startup with more detail
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email Service: Connection test FAILED');
        console.error('- Error Code:', error.code);
        console.error('- Error Message:', error.message);
        console.error('💡 TIP: This is usually a network firewall block on Render or a Gmail security rule.');
        console.error('   Try checking if "Less Secure Apps" or "App Passwords" are correctly set.');
    } else {
        console.log('✅ Email Service: Connection test SUCCESSFUL. Ready to send.');
    }
});

const fs = require('fs');
const path = require('path');

async function sendWelcomeEmail(toEmail) {
    // Check if user set up credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('⚠️  Email Service: Credentials not set. Skipping email send.');
        return { success: false, message: 'Server email credentials not configured.' };
    }

    try {
        // Load custom welcome message
        const contentPath = path.join(__dirname, '../data/content.json');

        // DEBUG: Log to file
        try {
            const debugLogPath = path.join(__dirname, '../email_debug.log');
            fs.appendFileSync(debugLogPath, `\n[${new Date().toISOString()}] Attempting to read content from: ${contentPath}\n`);
        } catch (e) { console.error('Logging failed', e); }

        // Defaults
        let welcomeMessage = "Thank you for subscribing to eScience Insights. We're excited to share our latest case studies, enterprise trends, and product updates with you.";
        let subject = "Welcome to eScience Insights! 🚀";
        let title = "Welcome to our community!";
        let quote = "Innovation distinguishes between a leader and a follower.";
        let closing = "Stay tuned for our next update!";

        try {
            if (fs.existsSync(contentPath)) {
                // DEBUG: File found
                try {
                    const debugLogPath = path.join(__dirname, '../email_debug.log');
                    fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] File exists at ${contentPath}\n`);
                } catch (e) { }

                const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

                // DEBUG: Log content keys
                try {
                    const debugLogPath = path.join(__dirname, '../email_debug.log');
                    fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] Content keys: ${Object.keys(content).join(',')}\n`);
                    if (content.blogPage && content.blogPage.settings) {
                        fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] Settings found: ${JSON.stringify(content.blogPage.settings)}\n`);
                    } else {
                        fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] blogPage.settings NOT found!\n`);
                    }
                } catch (e) { }

                if (content.blogPage && content.blogPage.settings) {
                    const settings = content.blogPage.settings;
                    if (settings.welcomeMessage) welcomeMessage = settings.welcomeMessage.replace(/\n/g, '<br>');
                    if (settings.emailSubject) subject = settings.emailSubject;
                    if (settings.emailTitle) title = settings.emailTitle;
                    if (settings.emailQuote) quote = settings.emailQuote;
                    if (settings.emailClosing) closing = settings.emailClosing;
                }
            } else {
                // DEBUG: File not found
                try {
                    const debugLogPath = path.join(__dirname, '../email_debug.log');
                    fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] File NOT found at ${contentPath}\n`);
                } catch (e) { }
            }
        } catch (err) {
            console.error('Error reading content.json for email:', err);
            // DEBUG: Error
            try {
                const debugLogPath = path.join(__dirname, '../email_debug.log');
                fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] Error reading file: ${err.message}\n`);
            } catch (e) { }
        }

        const info = await transporter.sendMail({
            from: '"eScience" <no-reply@electronicscience.net>',
            to: toEmail,
            subject: subject,
            list: {
                unsubscribe: [
                    ['eScience Unsubscribe', 'https://electronicscience.net/unsubscribe'],
                    {
                        url: 'mailto:unsubscribe@electronicscience.net',
                        comment: 'A short note about this url'
                    }
                ],
                help: 'https://electronicscience.net/help'
            },
            headers: {
                'List-Unsubscribe': '<mailto:unsubscribe@electronicscience.net>, <https://electronicscience.net/unsubscribe>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            },
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <div style="background: #000; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0; letter-spacing: 1px;">eScience</h2>
                    </div>
                    
                    <div style="padding: 30px;">
                        <h2 style="color: #0f3460; margin-top: 0;">${title}</h2>
                        
                        <p style="font-size: 16px; line-height: 1.6; color: #555;">
                            ${welcomeMessage}
                        </p>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #00d4ff; margin: 20px 0;">
                            <p style="margin: 0; color: #666; font-style: italic;">
                                "${quote}"
                            </p>
                        </div>
                        
                        <p style="font-size: 16px; line-height: 1.6; color: #555;">
                            ${closing}
                        </p>
                        
                        <a href="https://electronicscience.net" style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #00afff 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Visit Our Website</a>
                    </div>
                    
                    <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        &copy; ${new Date().getFullYear()} eScience. All rights reserved.<br>
                        You received this email because you subscribed on our website.
                    </div>
                </div>
            `,
        });

        console.log("Email sent: %s", info.messageId);
        return { success: true };
    } catch (error) {
        console.error(`❌ Email Service Error for ${toEmail}:`, error);
        return { success: false, error: error.message };
    }
}

async function sendPasswordResetEmail(toEmail, resetLink) {
    // Check if user set up credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('⚠️  Email Service: Credentials not set. Skipping email send.');
        return { success: false, message: 'Server email credentials not configured.' };
    }

    try {
        const info = await transporter.sendMail({
            from: '"eScience Admin" <no-reply@electronicscience.net>',
            to: toEmail,
            subject: "Password Reset Request",
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <div style="background: #0f3460; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">eScience Admin</h2>
                    </div>
                    <div style="padding: 30px;">
                        <h3 style="color: #0f3460; margin-top: 0;">Password Reset Request</h3>
                        <p>You requested a password reset for your eScience Admin account.</p>
                        <p>Click the button below to reset your password. This link is valid for 1 hour.</p>
                        <a href="${resetLink}" style="display: inline-block; background: #e94560; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">Reset Password</a>
                        <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
                    </div>
                </div>
            `
        });
        console.log("Password reset email sent: %s", info.messageId);
        return { success: true };
    } catch (error) {
        console.error(`❌ Email Service (Reset) Error for ${toEmail}:`, error);
        return { success: false, error: error.message };
    }
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
