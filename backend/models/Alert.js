const mongoose = require('mongoose');


const AlertSchema = new mongoose.Schema({
type: { type: String, required: true },
level: { type: String, enum: ['info','warning','critical'], default: 'warning' },
message: { type: String, required: true },
details: { type: mongoose.Schema.Types.Mixed },
createdAt: { type: Date, default: Date.now },
resolved: { type: Boolean, default: false },
resolvedAt: Date,
visibleOnPortal: { type: Boolean, default: false } // hidden on portal by default
});


module.exports = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);