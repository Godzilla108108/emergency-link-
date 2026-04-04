const mongoose = require('mongoose');

const EmergencyRequestSchema = new mongoose.Schema({
    patientName: { type: String }, // For patient-initiated requests
    patientCondition: { type: String, required: true },
    bloodGroup: { type: String, required: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Accepted', 'En Route', 'Completed'], default: 'Pending' },
    requestSource: { type: String, enum: ['Ambulance', 'Patient'], default: 'Ambulance' },
    selectedHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    eta: { type: String },
    otp: { type: String },
    otpVerified: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmergencyRequest', EmergencyRequestSchema);
