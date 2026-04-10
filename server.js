require('dotenv').config({ path: './env/env' });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (needed for Render/Heroku/etc. to get correct IP/protocol)
app.set('trust proxy', 1);

const { sendWelcomeEmail, sendPasswordResetEmail } = require('./services/emailService');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = '24h';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { success: false, message: "Too many login attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Security helper functions
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateJWT(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'escience-admin',
        audience: 'escience-users'
    });
}

function validateJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'escience-admin',
            audience: 'escience-users'
        });
    } catch (err) {
        return null;
    }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access token required" });
    }

    const decoded = validateJWT(token);
    if (!decoded) {
        return res.status(403).json({ success: false, message: "Invalid or expired token" });
    }

    req.user = decoded;
    req.token = token;
    next();
}

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        // Keep original extension, sanitize filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})
const upload = multer({ storage: storage });

const DATA_FILE = path.join(__dirname, 'data', 'content.json');
const CREDENTIALS_FILE = path.join(__dirname, 'data', 'credentials.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const RESET_TOKENS_FILE = path.join(__dirname, 'data', 'reset-tokens.json');

// --- Helper Functions ---
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading data file:", err);
        return {}; // Return empty object on error
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing data file:", err);
        return false;
    }
}

function readCredentials() {
    try {
        const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading credentials file:", err);
        // Create default admin with hashed password
        const defaultCredentials = {
            username: 'admin',
            password: hashPassword('escience2024'),
            forcePasswordChange: true
        };
        writeCredentials(defaultCredentials);
        return defaultCredentials;
    }
}

function writeCredentials(credentials) {
    try {
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing credentials file:", err);
        return false;
    }
}

function readSessions() {
    try {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function writeSessions(sessions) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing sessions file:", err);
        return false;
    }
}


function readResetTokens() {
    try {
        if (!fs.existsSync(RESET_TOKENS_FILE)) {
            return {};
        }
        const data = fs.readFileSync(RESET_TOKENS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function writeResetTokens(tokens) {
    try {
        fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify(tokens, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing reset tokens file:", err);
        return false;
    }
}

// --- API Routes ---

// GET Content
app.get('/api/content', (req, res) => {
    const data = readData();
    res.json(data);
});

// UPDATE Content
app.post('/api/content', authenticateToken, (req, res) => {
    const newData = req.body;

    // Validate data structure
    if (!newData || typeof newData !== 'object') {
        return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    if (writeData(newData)) {
        res.json({ success: true, message: "Content updated successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to save content" });
    }
});

// UPLOAD Image
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // Validate file type
    const allowedTypes = /jpeg|jpg|png|gif|svg|heic|mp4|webm|ogg/;
    const extname = allowedTypes.test(path.extname(req.file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(req.file.mimetype);

    if (!extname && !mimetype) {
        // Remove uploaded file if invalid
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: "Invalid file type" });
    }

    // Return the path relative to 'public' so frontend can use it
    const publicPath = 'uploads/' + req.file.filename;
    res.json({ success: true, filePath: publicPath });
});

// SUBSCRIBE Newsletter
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers.json');

    try {
        let subscribers = [];
        if (fs.existsSync(SUBSCRIBERS_FILE)) {
            const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
            subscribers = JSON.parse(data);
        }

        // Handle backward compatibility (strings vs objects)
        // Normalize checking by converting strings to objects temporarily or just check email specific field
        const exists = subscribers.some(s => (typeof s === 'string' ? s : s.email) === email);

        if (!exists) {
            // Save as object with date if it doesn't exist
            subscribers.push({
                email: email,
                date: new Date().toISOString()
            });
            fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
        }

        // Attempt to send welcome email (always send for verification/updates)
        console.log(`[DEBUG] Attempting to send welcome email to: ${email}`);
        sendWelcomeEmail(email).then(result => {
            if (result.success) {
                console.log(`✅ Welcome email successfully sent to ${email}`);
            } else {
                console.error(`❌ Welcome email FAILED for ${email}: ${result.message || result.error}`);
            }
        }).catch(err => {
            console.error(`💥 Unexpected error in welcome email promise for ${email}:`, err);
        });

        res.json({
            success: true,
            message: exists ? "Welcome back! We've sent you a fresh greeting email." : "Successfully subscribed!"
        });
    } catch (err) {
        console.error("Error saving subscriber:", err);
        res.status(500).json({ success: false, message: "Failed to save subscription" });
    }
});

// Diagnostic endpoint to test email sending directly
app.post('/api/test-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    console.log(`[DIAGNOSTIC] Testing welcome email to: ${email}`);
    const result = await sendWelcomeEmail(email);

    if (result.success) {
        res.json({ success: true, message: `Test email sent to ${email}` });
    } else {
        res.status(500).json({ success: false, message: "Email failed", error: result.error });
    }
});

// GET Subscribers
app.get('/api/subscribers', authenticateToken, (req, res) => {
    const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers.json');
    try {
        if (!fs.existsSync(SUBSCRIBERS_FILE)) {
            return res.json([]);
        }
        const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
        const subscribers = JSON.parse(data);

        // Normalize data for frontend
        const normalized = subscribers.map(s => {
            if (typeof s === 'string') return { email: s, date: null };
            return s;
        });

        res.json(normalized);
    } catch (err) {
        console.error("Error reading subscribers:", err);
        res.status(500).json({ success: false, message: "Failed to retrieve subscribers" });
    }
});

// DELETE Subscriber
app.delete('/api/subscribers', authenticateToken, (req, res) => {
    const { email } = req.body;
    const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers.json');

    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    try {
        if (!fs.existsSync(SUBSCRIBERS_FILE)) {
            return res.status(404).json({ success: false, message: "No subscribers found" });
        }

        const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
        let subscribers = JSON.parse(data);
        const initialLength = subscribers.length;

        subscribers = subscribers.filter(s => (typeof s === 'string' ? s : s.email) !== email);

        if (subscribers.length === initialLength) {
            return res.status(404).json({ success: false, message: "Subscriber not found" });
        }

        fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
        res.json({ success: true, message: "Subscriber removed" });
    } catch (err) {
        console.error("Error deleting subscriber:", err);
        res.status(500).json({ success: false, message: "Failed to delete subscriber" });
    }
});

// LOGIN
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password required" });
    }

    const credentials = readCredentials();

    if (username === credentials.username && hashPassword(password) === credentials.password) {
        // Generate JWT token
        const payload = {
            username: username,
            role: 'admin',
            iat: Math.floor(Date.now() / 1000)
        };

        const token = generateJWT(payload);

        res.json({
            success: true,
            token: token,
            user: {
                username: username,
                email: credentials.email || '',
                role: 'admin'
            },
            forcePasswordChange: credentials.forcePasswordChange || false,
            expiresIn: JWT_EXPIRES_IN
        });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// FORGOT PASSWORD
app.post('/api/forgot-password', loginLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const credentials = readCredentials();

        // Check if email matches admin email
        if (!credentials.email || credentials.email !== email) {
            // Security: Always return success to prevent email enumeration
            return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour

        const tokens = readResetTokens();
        tokens[token] = { expires };

        if (!writeResetTokens(tokens)) {
            throw new Error("Failed to write reset tokens to file");
        }

        // Use req.get('host') to get the host header (includes port if present)
        const resetLink = `${req.protocol}://${req.get('host')}/admin/index.html?mode=reset&token=${token}`;
        const emailResult = await sendPasswordResetEmail(email, resetLink);

        if (emailResult.success) {
            res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
        } else {
            console.error("Forgot Password Error:", emailResult.message || emailResult.error);
            res.status(500).json({ success: false, message: "Failed to send email: " + (emailResult.message || emailResult.error) });
        }
    } catch (err) {
        console.error("Critical Forgot Password Route Error:", err);
        res.status(500).json({ success: false, message: "Internal server error: " + err.message });
    }
});

// RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: "Token and password required" });

    const tokens = readResetTokens();
    if (!tokens[token] || tokens[token].expires < Date.now()) {
        return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({ success: false, message: "Password must contain uppercase, lowercase, and numbers" });
    }

    const credentials = readCredentials();
    credentials.password = hashPassword(newPassword);
    credentials.forcePasswordChange = false;
    writeCredentials(credentials);

    delete tokens[token];
    writeResetTokens(tokens);

    res.json({ success: true, message: "Password reset successfully" });
});

// CHANGE USERNAME
app.post('/api/change-username', authenticateToken, (req, res) => {
    const { newUsername } = req.body;

    if (!newUsername || newUsername.trim() === '') {
        return res.status(400).json({ success: false, message: "Username cannot be empty" });
    }

    if (newUsername.length < 3) {
        return res.status(400).json({ success: false, message: "Username must be at least 3 characters" });
    }

    const credentials = readCredentials();
    credentials.username = newUsername.trim();

    if (writeCredentials(credentials)) {
        res.json({ success: true, message: "Username updated successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to update username" });
    }
});

// CHANGE PASSWORD
app.post('/api/change-password', authenticateToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const credentials = readCredentials();

    if (hashPassword(currentPassword) !== credentials.password) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({ success: false, message: "New password must contain uppercase, lowercase, and numbers" });
    }

    credentials.password = hashPassword(newPassword);
    credentials.forcePasswordChange = false;

    if (writeCredentials(credentials)) {
        res.json({ success: true, message: "Password updated successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to update password" });
    }
});

// CHANGE EMAIL
app.post('/api/change-email', authenticateToken, (req, res) => {
    const { newEmail } = req.body;

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const credentials = readCredentials();
    credentials.email = newEmail.trim();

    if (writeCredentials(credentials)) {
        res.json({ success: true, message: "Email updated successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to update email" });
    }
});

// GET ADMIN PROFILE
app.get('/api/admin/profile', authenticateToken, (req, res) => {
    const credentials = readCredentials();
    res.json({
        username: credentials.username,
        email: credentials.email || '',
        role: 'admin'
    });
});

// DELETE uploaded file
app.delete('/api/upload/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public', 'uploads', filename);

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: "File deleted successfully" });
        } else {
            res.status(404).json({ success: false, message: "File not found" });
        }
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).json({ success: false, message: "Failed to delete file" });
    }
});

// GET uploaded files list
app.get('/api/uploads', authenticateToken, (req, res) => {
    const uploadsDir = path.join(__dirname, 'public', 'uploads');

    try {
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            return res.json({ files: [] });
        }

        const files = fs.readdirSync(uploadsDir);
        const fileList = files.map(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                url: `/uploads/${file}`
            };
        });

        res.json({ files: fileList });
    } catch (err) {
        console.error("Error reading uploads directory:", err);
        res.status(500).json({ success: false, message: "Failed to read uploads directory" });
    }
});

// Backup data
app.get('/api/backup', authenticateToken, (req, res) => {
    try {
        const data = readData();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `content-backup-${timestamp}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${backupFilename}"`);
        res.send(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error creating backup:", err);
        res.status(500).json({ success: false, message: "Failed to create backup" });
    }
});

// Restore data from backup
app.post('/api/restore', authenticateToken, (req, res) => {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
        return res.status(400).json({ success: false, message: "Invalid backup data" });
    }

    // Create backup of current data before restore
    try {
        const currentData = readData();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(__dirname, 'data', `backup-before-restore-${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(currentData, null, 2));
    } catch (err) {
        console.error("Error creating pre-restore backup:", err);
    }

    if (writeData(data)) {
        res.json({ success: true, message: "Data restored successfully" });
    } else {
        res.status(500).json({ success: false, message: "Failed to restore data" });
    }
});

// Validate data structure
app.post('/api/validate', authenticateToken, (req, res) => {
    const data = req.body;
    const errors = [];
    const warnings = [];

    // Basic structure validation
    if (!data || typeof data !== 'object') {
        errors.push("Invalid data structure");
        return res.json({ valid: false, errors, warnings });
    }

    // Check for required sections
    const requiredSections = ['hero', 'stats', 'solutions', 'whyUs', 'testimonials'];
    requiredSections.forEach(section => {
        if (!data[section]) {
            warnings.push(`Missing section: ${section}`);
        }
    });

    // Validate hero section
    if (data.hero && (!Array.isArray(data.hero.slides) || data.hero.slides.length === 0)) {
        errors.push("Hero section must have at least one slide");
    }

    // Validate stats
    if (data.stats && Array.isArray(data.stats)) {
        data.stats.forEach((stat, index) => {
            if (!stat.label || !stat.number) {
                warnings.push(`Stat #${index + 1} missing label or number`);
            }
        });
    }

    // Validate solutions
    if (data.solutions && Array.isArray(data.solutions)) {
        data.solutions.forEach((solution, index) => {
            if (!solution.title || !solution.description) {
                warnings.push(`Solution #${index + 1} missing title or description`);
            }
        });
    }

    res.json({
        valid: errors.length === 0,
        errors,
        warnings,
        message: errors.length === 0 ? "Data structure is valid" : "Data structure has errors"
    });
});

// Serve Admin Panel explicitly (optional, since static serves it, but good for routing)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Save Page Content Endpoint
app.post('/api/save-page', authenticateToken, (req, res) => {
    const { page, content } = req.body;

    if (!page || !content) {
        return res.status(400).json({ success: false, message: "Page name and content are required" });
    }

    const pageMap = {
        'careers': 'public/nav-pages/careers.html',
        'blog': 'public/nav-pages/blog.html',
        'contact': 'public/nav-pages/contact-us.html'
    };

    const filePath = pageMap[page];
    if (!filePath) {
        return res.status(400).json({ success: false, message: "Invalid page name" });
    }

    try {
        const fullPath = path.join(__dirname, filePath);

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write the file
        fs.writeFileSync(fullPath, content, 'utf8');

        res.json({ success: true, message: `${page} page saved successfully` });
    } catch (err) {
        console.error(`Error saving ${page} page:`, err);
        res.status(500).json({ success: false, message: `Error saving page: ${err.message}` });
    }
});

// Start Server
// Endpoint to list available SVG icons

// Endpoint to list available SVG icons
app.get('/api/icons', (req, res) => {
    const assetsDir = path.join(__dirname, 'public/assets');

    const getAllFiles = (dirPath, arrayOfFiles) => {
        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];

        files.forEach(function (file) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(path.relative(path.join(__dirname, 'public'), fullPath));
            }
        });
        return arrayOfFiles;
    }

    try {
        const allFiles = getAllFiles(assetsDir);
        const svgs = allFiles
            .filter(file => file.toLowerCase().endsWith('.svg'))
            .map(file => file.split(path.sep).join('/'));

        res.json(svgs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to scan assets' });
    }
});

// Error handling middleware
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    if (err.code === 'ENOENT') {
        return res.status(404).json({ success: false, message: "File not found" });
    }

    if (err.code === 'EACCES') {
        return res.status(403).json({ success: false, message: "Permission denied" });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
}

// --- Analytics Logic ---
const ANALYTICS_FILE = path.join(__dirname, 'data', 'analytics.json');

function readAnalytics() {
    try {
        if (!fs.existsSync(ANALYTICS_FILE)) {
            const initialData = {
                totalVisitors: 0,
                pageViews: {},
                dailyStats: {},
                deviceStats: { mobile: 0, desktop: 0 },
                trafficSources: { direct: 0, search: 0, social: 0, referral: 0 }
            };
            writeAnalytics(initialData);
            return initialData;
        }
        const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading analytics file:", err);
        return { totalVisitors: 0, pageViews: {}, dailyStats: {} };
    }
}

function writeAnalytics(data) {
    try {
        fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing analytics file:", err);
        return false;
    }
}

// Track Page View
app.post('/api/analytics/track', (req, res) => {
    const { path: pagePath, referrer } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const today = new Date().toISOString().split('T')[0];

    // Simple hash for "unique" visitor tracking (privacy friendly)
    const visitorHash = crypto.createHash('md5').update(ip + userAgent + today).digest('hex');

    const data = readAnalytics();

    // Initialize daily stats if needed
    if (!data.dailyStats[today]) {
        data.dailyStats[today] = {
            visitors: 0,
            pageViews: 0,
            uniqueHashes: []
        };
    }

    // Increment Global Page Views
    if (!data.pageViews[pagePath]) {
        data.pageViews[pagePath] = 0;
    }
    data.pageViews[pagePath]++;

    // Update Daily Stats
    data.dailyStats[today].pageViews++;

    // Check for unique visitor
    if (!data.dailyStats[today].uniqueHashes.includes(visitorHash)) {
        data.dailyStats[today].uniqueHashes.push(visitorHash);
        data.dailyStats[today].visitors++;
        data.totalVisitors++; // Increment global total visitors (unique per day)

        // --- Device Tracking ---
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const deviceType = isMobile ? 'mobile' : 'desktop';
        if (!data.deviceStats) data.deviceStats = { mobile: 0, desktop: 0 }; // Backwards compatibility
        if (!data.deviceStats[deviceType]) data.deviceStats[deviceType] = 0;
        data.deviceStats[deviceType]++;

        // --- Traffic Source Tracking ---
        let source = 'direct';
        if (referrer) {
            if (referrer.includes('google') || referrer.includes('bing') || referrer.includes('yahoo')) {
                source = 'search';
            } else if (referrer.includes('facebook') || referrer.includes('twitter') || referrer.includes('linkedin') || referrer.includes('instagram')) {
                source = 'social';
            } else if (!referrer.includes(req.get('host'))) {
                // External referral (not same site)
                source = 'referral';
            } else {
                // Internal link (same domain), don't count as new traffic source for visitor?
                // Actually, unique visitor check is per day. 
                // If they came from internal link, they probably were already tracked on the first page load?
                // But uniqueHashes check prevents double counting for "visitors" count.
                // We should only count source if it's the *entry* for them?
                // Simplification for now: Count source for every unique visitor hit (once per day).
                // If they navigate internally, referrer is self.
                // If it's internal navigation, we ideally treat it as continuing session.
                // But since we track unique daily visitors:
                // If referrer is empty -> Direct
                // If referrer is external -> Referral/Social/Search
                // If referrer is internal -> It's likely they refreshed or came from another page.
                // We'll trust the logic: "If strict unique check passed (new daily visitor), we count source now."
                // But if they landed on Home (Direct) then went to Careers (Internal Ref),
                // we only want to track them ONCE.
                // The `if (!uniqueHashes.includes)` block handles the "ONCE" part!
                // So whatever the referrer is *at that moment of first daily visit* is the source.
                if (referrer.includes(req.get('host'))) {
                    // Valid "Direct" / "Self" for first daily hit? 
                    // Maybe they bookmarked a deep link? Or refreshed at 00:01 AM?
                    // Let's call it 'direct' if internal or empty for simplicity, or separate 'internal'? 
                    // 'direct' is standard for "unknown/typed/bookmarked".
                    source = 'direct';
                }
            }
        }

        if (!data.trafficSources) data.trafficSources = { direct: 0, search: 0, social: 0, referral: 0 };
        if (!data.trafficSources[source]) data.trafficSources[source] = 0;
        data.trafficSources[source]++;
    }

    // Save
    writeAnalytics(data);

    res.json({ success: true });
});

// Get Analytics Data
app.get('/api/analytics', authenticateToken, (req, res) => {
    const data = readAnalytics();

    // Clean up sensitive/internal data (hashes) before sending
    const safeDailyStats = {};
    Object.keys(data.dailyStats).forEach(date => {
        safeDailyStats[date] = {
            visitors: data.dailyStats[date].visitors,
            pageViews: data.dailyStats[date].pageViews
        };
    });

    // Transform page paths for better display names
    const transformedPageViews = {};
    Object.keys(data.pageViews).forEach(path => {
        let displayName = path;
        if (path === '/index.html') {
            displayName = 'Admin Panel';
        }
        transformedPageViews[displayName] = data.pageViews[path];
    });

    res.json({
        totalVisitors: data.totalVisitors,
        pageViews: transformedPageViews,
        dailyStats: safeDailyStats,
        deviceStats: data.deviceStats || { mobile: 0, desktop: 0 },
        trafficSources: data.trafficSources || { direct: 0, search: 0, social: 0, referral: 0 }
    });
});

// Archive Analytics
app.post('/api/analytics/archive', authenticateToken, (req, res) => {
    console.log('Archive endpoint hit');
    const data = readAnalytics();
    const now = new Date();
    now.setMonth(now.getMonth() - 1); // Archive previous month
    const archiveId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const archiveLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const ARCHIVES_FILE = path.join(__dirname, 'data', 'analytics-archives.json');
    let archives = {};
    if (fs.existsSync(ARCHIVES_FILE)) {
        archives = JSON.parse(fs.readFileSync(ARCHIVES_FILE, 'utf8'));
    }

    archives[archiveId] = {
        id: archiveId,
        label: archiveLabel,
        archivedAt: now.toISOString(),
        data: data
    };

    fs.writeFileSync(ARCHIVES_FILE, JSON.stringify(archives, null, 2));

    // Reset current analytics
    writeAnalytics({
        totalVisitors: 0,
        pageViews: {},
        dailyStats: {},
        deviceStats: { mobile: 0, desktop: 0 },
        trafficSources: { direct: 0, search: 0, social: 0, referral: 0 }
    });

    res.json({ success: true, message: 'Analytics archived successfully' });
});

// Get Archives List
app.get('/api/analytics/archives', authenticateToken, (req, res) => {
    const ARCHIVES_FILE = path.join(__dirname, 'data', 'analytics-archives.json');
    if (!fs.existsSync(ARCHIVES_FILE)) {
        return res.json([]);
    }
    try {
        const archives = JSON.parse(fs.readFileSync(ARCHIVES_FILE, 'utf8'));
        res.json(Object.values(archives).map(a => ({ id: a.id, label: a.label, archivedAt: a.archivedAt })));
    } catch (err) {
        console.error('Error reading archives:', err);
        res.json([]);
    }
});

// Get Single Archive
app.get('/api/analytics/archive/:id', authenticateToken, (req, res) => {
    const ARCHIVES_FILE = path.join(__dirname, 'data', 'analytics-archives.json');
    if (!fs.existsSync(ARCHIVES_FILE)) {
        return res.status(404).json({ success: false, message: 'Archive not found' });
    }
    try {
        const archives = JSON.parse(fs.readFileSync(ARCHIVES_FILE, 'utf8'));
        const archive = archives[req.params.id];
        if (!archive) {
            return res.status(404).json({ success: false, message: 'Archive not found' });
        }
        res.json({
            label: archive.label,
            totalVisitors: archive.data.totalVisitors,
            totalPageViews: Object.values(archive.data.pageViews).reduce((a, b) => a + b, 0),
            pageViews: archive.data.pageViews,
            deviceStats: archive.data.deviceStats,
            trafficSources: archive.data.trafficSources
        });
    } catch (err) {
        console.error('Error reading archive:', err);
        res.status(500).json({ success: false, message: 'Error reading archive' });
    }
});

// Delete Single Archive
app.delete('/api/analytics/archive/:id', authenticateToken, (req, res) => {
    const ARCHIVES_FILE = path.join(__dirname, 'data', 'analytics-archives.json');
    if (!fs.existsSync(ARCHIVES_FILE)) {
        return res.status(404).json({ success: false, message: 'Archive not found' });
    }
    try {
        const archives = JSON.parse(fs.readFileSync(ARCHIVES_FILE, 'utf8'));
        if (!archives[req.params.id]) {
            return res.status(404).json({ success: false, message: 'Archive not found' });
        }

        delete archives[req.params.id];
        fs.writeFileSync(ARCHIVES_FILE, JSON.stringify(archives, null, 2));

        res.json({ success: true, message: 'Archive deleted successfully' });
    } catch (err) {
        console.error('Error deleting archive:', err);
        res.status(500).json({ success: false, message: 'Error deleting archive' });
    }
});

// 404 handler - only for API routes that don't exist
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Apply error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel available at http://localhost:${PORT}/admin`);

    // Ensure required directories exist
    const uploadsDir2 = path.join(__dirname, 'public', 'uploads');
    const dataDir = path.join(__dirname, 'data');


    [uploadsDir2, dataDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });

    // Initialize credentials if they don't exist
    readCredentials();

    // Automatic monthly archiving - runs at 00:00 on the 1st of every month
    cron.schedule('0 0 1 * *', () => {
        console.log('Running automatic monthly analytics archive...');
        try {
            const data = readAnalytics();
            const now = new Date();
            now.setMonth(now.getMonth() - 1); // Archive previous month
            const archiveId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const archiveLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

            const ARCHIVES_FILE = path.join(__dirname, 'data', 'analytics-archives.json');
            let archives = {};
            if (fs.existsSync(ARCHIVES_FILE)) {
                archives = JSON.parse(fs.readFileSync(ARCHIVES_FILE, 'utf8'));
            }

            archives[archiveId] = {
                id: archiveId,
                label: archiveLabel,
                archivedAt: new Date().toISOString(),
                data: data
            };

            fs.writeFileSync(ARCHIVES_FILE, JSON.stringify(archives, null, 2));

            // Reset current analytics
            writeAnalytics({
                totalVisitors: 0,
                pageViews: {},
                dailyStats: {},
                deviceStats: { mobile: 0, desktop: 0 },
                trafficSources: { direct: 0, search: 0, social: 0, referral: 0 }
            });

            console.log(`✓ Analytics archived automatically: ${archiveLabel}`);
        } catch (err) {
            console.error('Automatic archive failed:', err);
        }
    });

    console.log('Security features enabled:');
    console.log('- Rate limiting on login attempts');
    console.log('- Password hashing');
    console.log('- Session-based authentication');
    console.log('- Token expiration (24 hours)');
    console.log('- Automatic monthly analytics archiving');
});
