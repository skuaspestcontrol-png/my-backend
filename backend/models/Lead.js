const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  whatsappNumber: { type: String },
  address: { type: String },
  areaName: { type: String },
  pinCode: { type: String },
  pestIssue: { type: String }, // e.g., Termites, Bed Bugs, Rodents
  assignedTo: { type: String }, // Sales Team member name/ID
  followupDate: { type: Date },
  customerSegment: { 
    type: String, 
    enum: ['Commercial', 'Residential'], 
    default: 'Residential' 
  },
  leadSource: { type: String }, // GMB, Reference, GoogleAds, Call, etc.
  customLeadSource: { type: String }, // In case they select "Other"
  leadStatus: { 
    type: String, 
    enum: ['Interested', 'Rejected', 'Followup', 'Converted'], 
    default: 'Interested' 
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lead', leadSchema);