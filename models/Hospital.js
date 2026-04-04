const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    icuBeds: { type: Number, default: 0 },
    emergencyBeds: { type: Number, default: 0 },
    bloodAvailable: { type: Map, of: Number }, // { "B+": 5, "O-": 2 }
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hospital', HospitalSchema);
