require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_secret_key_123';

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
app.use(cors());
app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        if (err.message.includes('selection timeout') || err.message.includes('SSL alert number 80')) {
            console.error('👉 TIP: This is likely a Network/White-list issue. Ensure your current IP is whitelisted in MongoDB Atlas (Network Access).');
        }
    });

// Models
const Hospital = require('./models/Hospital');
const EmergencyRequest = require('./models/EmergencyRequest');
const Patient = require('./models/Patient');

// Socket.io Connection
io.on('connection', (socket) => {
    socket.on('join_hospital', (hospitalId) => {
        socket.join(hospitalId);
    });
    socket.on('join_patient', (patientId) => {
        socket.join(patientId);
    });
});

// Helper function to calculate distance (Haversine Formula)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// APIs
// 0. Hospital Auth
app.post('/hospital/register', async (req, res) => {
    try {
        const { name, location, latitude, longitude, email, password } = req.body;
        const existing = await Hospital.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const hospital = new Hospital({ name, location, latitude, longitude, email, password: hashedPassword });
        await hospital.save();
        const token = jwt.sign({ id: hospital._id, name: hospital.name, role: 'hospital' }, JWT_SECRET);
        res.json({ token, hospitalId: hospital._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/hospital/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hospital = await Hospital.findOne({ email });
        if (!hospital) return res.status(400).json({ error: 'Hospital not found' });
        const validPassword = await bcrypt.compare(password, hospital.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ id: hospital._id, name: hospital.name, role: 'hospital' }, JWT_SECRET);
        res.json({ token, hospitalId: hospital._id, name: hospital.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/hospital/me', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'hospital') return res.status(403).json({ error: 'Unauthorized role.' });
        const hospital = await Hospital.findById(req.user.id).select('-password');
        if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });
        res.json(hospital);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 0.1 Patient Auth
app.post('/patient/register', async (req, res) => {
    try {
        const { name, email, password, age, medicalHistory, bloodGroup, phone } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        const existing = await Patient.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const patientData = {
            name,
            email,
            password: hashedPassword,
            age: age ? parseInt(age) : null,
            medicalHistory: medicalHistory || '',
            bloodGroup: bloodGroup || 'Unknown',
            phone: phone || ''
        };

        const patient = new Patient(patientData);
        await patient.save();
        
        const token = jwt.sign({ id: patient._id, name: patient.name, role: 'patient' }, JWT_SECRET);
        res.json({ token, patientId: patient._id });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: 'Failed to register patient: ' + err.message });
    }
});

app.post('/patient/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const patient = await Patient.findOne({ email });
        if (!patient) return res.status(400).json({ error: 'Patient not found' });
        const validPassword = await bcrypt.compare(password, patient.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ id: patient._id, name: patient.name, role: 'patient' }, JWT_SECRET);
        res.json({ token, patientId: patient._id, name: patient.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/patient/me', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') return res.status(403).json({ error: 'Unauthorized role.' });
        const patient = await Patient.findById(req.user.id).select('-password');
        if (!patient) return res.status(404).json({ error: 'Patient not found.' });
        res.json(patient);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Create Emergency Request & Find Nearby Hospitals
app.post('/emergency', async (req, res) => {
    try {
        const { patientName, patientCondition, bloodGroup, severity, latitude, longitude, requestSource } = req.body;
        const emergency = new EmergencyRequest({ 
            patientName, 
            patientCondition, 
            bloodGroup, 
            severity, 
            latitude, 
            longitude,
            requestSource: requestSource || 'Ambulance'
        });
        await emergency.save();
        const hospitals = await Hospital.find();
        const nearbyHospitals = hospitals.map(h => {
            const distance = getDistance(latitude, longitude, h.latitude, h.longitude);
            const bloodUnits = h.bloodAvailable ? (h.bloodAvailable[bloodGroup] || 0) : 0;
            
            // Priority Scoring Logic
            // 1. Proximity (Higher is better)
            const distScore = (1 / (distance + 1)) * 1000;
            // 2. Blood Stock (Huge bonus if matching blood available)
            const bloodScore = (bloodUnits > 0 ? 500 : 0) + (bloodUnits * 5);
            // 3. Bed Availability
            const bedScore = (h.icuBeds * 15) + (h.emergencyBeds * 10);
            
            return {
                ...h._doc,
                distance,
                priorityScore: distScore + bloodScore + bedScore
            };
        }).sort((a, b) => b.priorityScore - a.priorityScore);

        res.json({ emergencyId: emergency._id, nearbyHospitals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/hospitals', async (req, res) => {
    try {
        const hospitals = await Hospital.find();
        res.json(hospitals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/hospital/update', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'hospital') return res.status(403).json({ error: 'Unauthorized role.' });
        const { icuBeds, emergencyBeds, bloodAvailable } = req.body;
        const hospital = await Hospital.findByIdAndUpdate(req.user.id, {
            icuBeds, emergencyBeds, bloodAvailable, lastUpdated: Date.now()
        }, { new: true });
        res.json(hospital);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/hospital/alerts', authenticateToken, async (req, res) => {
    console.log("Fetching alerts for hospital:", req.user.id);
    try {
        if (req.user.role !== 'hospital') return res.status(403).json({ error: 'Unauthorized role.' });
        const alerts = await EmergencyRequest.find({
            selectedHospital: req.user.id,
            status: 'Accepted'
        }).sort({ timestamp: -1 });
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/alert', async (req, res) => {
    try {
        const { emergencyId, hospitalId, eta } = req.body;
        const emergency = await EmergencyRequest.findById(emergencyId);
        if (!emergency) return res.status(404).json({ error: 'Emergency not found' });
        emergency.selectedHospital = hospitalId;
        emergency.eta = eta || 'Calculating...';
        emergency.status = 'Accepted';
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        emergency.otp = otp;
        
        await emergency.save();
        io.to(hospitalId).emit('incoming_patient', {
            emergencyId: emergency._id, 
            patientName: emergency.patientName,
            patientCondition: emergency.patientCondition,
            bloodGroup: emergency.bloodGroup, severity: emergency.severity, 
            eta: eta || 'Calculating...', otp: otp,
            requestSource: emergency.requestSource
        });
        res.json({ success: true, otp: otp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/hospital/verify-otp', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'hospital') return res.status(403).json({ error: 'Unauthorized role.' });
        const { emergencyId, otp } = req.body;
        const emergency = await EmergencyRequest.findById(emergencyId);
        
        if (!emergency) return res.status(404).json({ error: 'Emergency request not found' });
        if (emergency.selectedHospital.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized. This request is for another hospital.' });
        }
        
        if (emergency.otp === otp) {
            emergency.status = 'Completed';
            emergency.otpVerified = true;
            await emergency.save();
            res.json({ success: true, message: 'OTP verified and case completed' });
        } else {
            res.status(400).json({ error: 'Invalid OTP' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/seed', async (req, res) => {
    const sampleHospitals = [
        { name: "City Hospital", location: "Downtown", latitude: 28.6139, longitude: 77.2090, email: "city@h.com", password: await bcrypt.hash("city123", 10), icuBeds: 10, emergencyBeds: 20, bloodAvailable: { "O+": 10, "B+": 5 } },
        { name: "Metro Clinic", location: "Suburbs", latitude: 28.5355, longitude: 77.3910, email: "metro@h.com", password: await bcrypt.hash("metro123", 10), icuBeds: 5, emergencyBeds: 10, bloodAvailable: { "A+": 8, "AB+": 2 } }
    ];
    await Hospital.deleteMany({});
    await Hospital.insertMany(sampleHospitals);
    res.send("Database seeded");
});

app.get('/blood', (req, res) => {
    res.sendFile(__dirname + '/public/blood.html');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
