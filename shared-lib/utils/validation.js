/**
 * Shared validation utilities for Army Exam App.
 * Centralizes army number format checks so every module uses the same rules.
 */

// Pattern 1: Old format - JC543031A (2 letters + 6 digits + optional letter)
const OLD_ARMY_NUMBER_PATTERN = /^[A-Z]{2}\d{6}[A-Z]?$/;
// Pattern 2: New format - 145699Z (variable length digits + letter)
const NEW_ARMY_NUMBER_PATTERN = /^\d+[A-Z]$/;

/**
 * Validate an army number string against known formats.
 * Supports both old format (e.g. JC543031A) and new format (e.g. 145699Z).
 * @param {string} armyNumber
 * @returns {boolean}
 */
function isValidArmyNumber(armyNumber) {
    if (!armyNumber || typeof armyNumber !== 'string') return false;
    return OLD_ARMY_NUMBER_PATTERN.test(armyNumber) || NEW_ARMY_NUMBER_PATTERN.test(armyNumber);
}

module.exports = {
    isValidArmyNumber,
    OLD_ARMY_NUMBER_PATTERN,
    NEW_ARMY_NUMBER_PATTERN
};
