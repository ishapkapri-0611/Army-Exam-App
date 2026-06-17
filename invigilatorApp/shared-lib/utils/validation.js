/**
 * Re-exports validation utilities from the root shared-lib.
 * The canonical implementation lives at shared-lib/utils/validation.js.
 */
const path = require('path');

let validation;
try {
    validation = require('../../../shared-lib/utils/validation');
} catch (e) {
    const resourcePath = path.join(process.resourcesPath || '', 'shared-lib', 'utils', 'validation');
    validation = require(resourcePath);
}

module.exports = validation;
