/**
 * Shared library entry point.
 * Re-exports all shared utilities for convenient access.
 *
 * Usage:
 *   const { validation, DocumentParser, ExamTimer, ... } = require('../shared-lib');
 */

const DocumentParser = require('./utils/document-parser');
const ExamTimer = require('./utils/exam-timer');
const NetworkDiscovery = require('./utils/network-discovery');
const ProductionLogger = require('./utils/production-logger');
const AnalyticsEngine = require('./utils/analytics-engine');
const SecurityManager = require('./utils/security-manager');
const validation = require('./utils/validation');

module.exports = {
    DocumentParser,
    ExamTimer,
    NetworkDiscovery,
    ProductionLogger,
    AnalyticsEngine,
    SecurityManager,
    validation,
    isValidArmyNumber: validation.isValidArmyNumber
};
