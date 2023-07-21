function isEquivalent(a,b) {
    if(!a || !b) return false;

    if(typeof a === 'object' && typeof b === 'object') {
        return JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(a, Object.keys(b).sort());
    } else {
        return a === b;
    }
}

module.exports = {
    isEquivalent
}