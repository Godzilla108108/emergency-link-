require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

const sampleHospitals = [
    { name: "City Hospital", location: "Downtown", latitude: 28.6139, longitude: 77.2090, icuBeds: 10, emergencyBeds: 20, bloodAvailable: { "O+": 10, "B+": 5 } },
    { name: "Metro Clinic", location: "Suburbs", latitude: 28.5355, longitude: 77.3910, icuBeds: 5, emergencyBeds: 10, bloodAvailable: { "A+": 8, "AB+": 2 } },
    { name: "Sunrise Medical Center", location: "East Side", latitude: 28.6328, longitude: 77.2197, icuBeds: 15, emergencyBeds: 30, bloodAvailable: { "O-": 4, "A-": 6 } }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');
        await Hospital.deleteMany({});
        await Hospital.insertMany(sampleHospitals);
        console.log('Database seeded with sample hospitals!');
        process.exit();
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seed();
