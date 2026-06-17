/**
 * Re-exports DocumentParser from the root shared-lib to avoid code duplication.
 * The canonical implementation lives at shared-lib/utils/document-parser.js.
 *
 * NOTE: In packaged Electron builds, this re-export requires the root shared-lib
 * to be accessible. During development this works via relative path resolution.
 * For production builds, the electron-builder extraResources config copies the
 * root shared-lib alongside the app.
 */
const path = require('path');

let DocumentParser;
try {
    // Development: resolve relative to project root
    DocumentParser = require('../../../shared-lib/utils/document-parser');
} catch (e) {
    // Packaged build: resolve from extraResources
    const resourcePath = path.join(process.resourcesPath || '', 'shared-lib', 'utils', 'document-parser');
    DocumentParser = require(resourcePath);
}

module.exports = DocumentParser;
