/**
 * Browser-compatible version of validation utilities.
 * Exposes validators on window.ArmyValidation for use in renderer scripts.
 */
(function () {
    var OLD_ARMY_NUMBER_PATTERN = /^[A-Z]{2}\d{6}[A-Z]?$/;
    var NEW_ARMY_NUMBER_PATTERN = /^\d+[A-Z]$/;

    function isValidArmyNumber(armyNumber) {
        if (!armyNumber || typeof armyNumber !== 'string') return false;
        return OLD_ARMY_NUMBER_PATTERN.test(armyNumber) || NEW_ARMY_NUMBER_PATTERN.test(armyNumber);
    }

    window.ArmyValidation = {
        isValidArmyNumber: isValidArmyNumber,
        OLD_ARMY_NUMBER_PATTERN: OLD_ARMY_NUMBER_PATTERN,
        NEW_ARMY_NUMBER_PATTERN: NEW_ARMY_NUMBER_PATTERN
    };
})();
