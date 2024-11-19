//server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const jimp = require('jimp');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
// Update CORS configuration
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Connected to MongoDB Database");
        console.log("Database Name:", mongoose.connection.name);
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB Database", err);
    });

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    passkey: { type: String, required: true },
    profilePicture: { type: String, default: 'resources/Default.jpg' }
});

const User = mongoose.model('User', UserSchema);


// Update the file upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        // Ensure upload directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});


const upload = multer({ storage: storage });

// Message Schema
const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, required: true, enum: ['text', 'encrypted', 'stego'] },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', MessageSchema);

// Get user profile
app.get('/api/user/:username/profile-picture', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, profilePicture: user.profilePicture });
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all contacts
app.get('/api/contacts', async (req, res) => {
    try {
        const users = await User.find({}, { username: 1, profilePicture: 1, _id: 0 });
        res.json(users);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get chat history
app.get('/api/messages/:user1/:user2', async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.params.user1, receiver: req.params.user2 },
                { sender: req.params.user2, receiver: req.params.user1 }
            ]
        }).sort('timestamp');
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching chat history' });
    }
});

// Send message
app.post('/api/messages/send', async (req, res) => {
    try {
        const { sender, receiver, content, type } = req.body;
        const message = new Message({
            sender,
            receiver,
            content,
            type
        });
        await message.save();
        res.status(201).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Error sending message' });
    }
});

// Steganography endpoint
app.post('/api/messages/stego', upload.single('image'), async (req, res) => {
    if (!req.file || !req.body.message) {
        return res.status(400).json({ success: false, message: 'Image and message are required' });
    }

    try {
        const image = await jimp.read(req.file.path);
        const message = req.body.message;
        const stegoImage = await embedMessageInImage(image, message);
        
        const outputFilename = `stego_${Date.now()}.png`;
        const outputPath = path.join(__dirname, 'uploads', outputFilename);
        await stegoImage.writeAsync(outputPath);

        // Delete the original uploaded file
        fs.unlinkSync(req.file.path);

        // Return the correct URL path
        res.json({
            success: true,
            imageUrl: `http://127.0.0.1:3000/uploads/${outputFilename}`,
            message: 'Steganography successful'
        });
    } catch (error) {
        console.error('Steganography error:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'Error processing steganography' });
    }
});


// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
});



// Extract message from steganographic image
app.post('/api/messages/stego/extract', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Image is required' });
    }

    try {
        const image = await jimp.read(req.file.path);
        const extractedMessage = await extractMessageFromImage(image);
        
        // Delete the uploaded file
        await fs.unlink(req.file.path);

        res.json({
            success: true,
            message: extractedMessage
        });
    } catch (error) {
        console.error('Message extraction error:', error);
        res.status(500).json({ success: false, message: 'Error extracting message' });
    }
});

// Steganography helper functions
async function embedMessageInImage(image, message) {
    // Convert message to binary
    const binaryMessage = message.split('')
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('');

    const messageLength = binaryMessage.length;
    let bitIndex = 0;

    // Embed message length first (32 bits)
    const lengthBinary = messageLength.toString(2).padStart(32, '0');
    for (let i = 0; i < 32; i++) {
        const x = i % image.getWidth();
        const y = Math.floor(i / image.getWidth());
        const pixel = image.getPixelColor(x, y);
        const r = (pixel >> 24) & 255;
        const g = (pixel >> 16) & 255;
        const b = (pixel >> 8) & 255;
        const a = pixel & 255;

        // Modify least significant bit of blue channel
        const newB = (b & 254) | parseInt(lengthBinary[i]);
        const newPixel = (r << 24) | (g << 16) | (newB << 8) | a;
        image.setPixelColor(newPixel, x, y);
    }

    // Embed message
    for (let i = 0; bitIndex < messageLength; i++) {
        const x = (i + 32) % image.getWidth();
        const y = Math.floor((i + 32) / image.getWidth());
        
        if (y >= image.getHeight()) break;

        const pixel = image.getPixelColor(x, y);
        const r = (pixel >> 24) & 255;
        const g = (pixel >> 16) & 255;
        const b = (pixel >> 8) & 255;
        const a = pixel & 255;

        const newB = (b & 254) | parseInt(binaryMessage[bitIndex]);
        const newPixel = (r << 24) | (g << 16) | (newB << 8) | a;
        image.setPixelColor(newPixel, x, y);
        bitIndex++;
    }

    return image;
}

async function extractMessageFromImage(image) {
    // Extract message length first (32 bits)
    let lengthBinary = '';
    for (let i = 0; i < 32; i++) {
        const x = i % image.getWidth();
        const y = Math.floor(i / image.getWidth());
        const pixel = image.getPixelColor(x, y);
        const b = (pixel >> 8) & 255;
        lengthBinary += b & 1;
    }
    const messageLength = parseInt(lengthBinary, 2);

    // Extract message
    let binaryMessage = '';
    for (let i = 0; binaryMessage.length < messageLength; i++) {
        const x = (i + 32) % image.getWidth();
        const y = Math.floor((i + 32) / image.getWidth());
        
        if (y >= image.getHeight()) break;

        const pixel = image.getPixelColor(x, y);
        const b = (pixel >> 8) & 255;
        binaryMessage += b & 1;
    }

    // Convert binary message back to text
    let message = '';
    for (let i = 0; i < binaryMessage.length; i += 8) {
        const byte = binaryMessage.substr(i, 8);
        message += String.fromCharCode(parseInt(byte, 2));
    }

    return message;
}

// Verify user's passkey
app.post('/api/verify-passkey', async (req, res) => {
    try {
        const { username, passkey } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isValid = user.passkey === passkey;
        res.json({ success: isValid });
    } catch (error) {
        console.error('Error verifying passkey:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'client')));


// Profile Picture Upload Route
app.post('/uploadProfilePicture', upload.single('profilePicture'), (req, res) => {
    console.log('Received upload request');
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const profilePicturePath = '/uploads/' + req.file.filename;
    console.log('File uploaded successfully:', profilePicturePath);
    res.json({ success: true, filePath: profilePicturePath });
});

// Check if username exists
app.post('/check-username', async (req, res) => {
    const { username } = req.body;
    
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }
        res.json({ success: true, message: 'Username is available.' });
    } catch (err) {
        console.error('Error checking username:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Registration endpoint
app.post('/register', upload.single('profilePicture'), async (req, res) => {
    console.log('Received registration request');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const { username, password, passkey } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : 'resources/Default.jpg';

    if (!username || !password || !passkey) {
        console.error('Missing required fields');
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.error('Username already exists:', username);
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            password: hashedPassword,
            passkey,
            profilePicture
        });

        await newUser.save();
        console.log('User registered successfully:', username);
        res.status(201).json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ success: false, message: 'Error registering user', error: err.message });
    }
});

// Complete registration
app.post('/complete-registration', upload.single('profilePicture'), async (req, res) => {
    console.log('Received complete registration request');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const { username, password, passkey } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : 'resources/Default.jpg';

    if (!username || !password || !passkey) {
        console.error('Missing required fields');
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.error('Username already exists:', username);
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            password: hashedPassword,
            passkey,
            profilePicture
        });

        await newUser.save();
        console.log('User registered successfully:', username);
        res.status(201).json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ success: false, message: 'Error registering user', error: err.message });
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        console.log('Login Request:', req.body);

        let user = await User.findOne({ username });
        if (!user) {
            console.log('User not found:', username);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Invalid credentials for user:', username);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('Login successful for user:', username);
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add a test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is reachable' });
});

// Fallback route for any other request (serve index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});