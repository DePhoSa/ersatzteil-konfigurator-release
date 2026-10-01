const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/firebase-db.js'), 'utf8');
const baseline = execFileSync('git', ['show', '562c25e:js/firebase-db.js'], { cwd: root, encoding: 'utf8' });

// Execute the real proposal post-processing without DOM, Firebase or network.
function calculate(code, B, top, h, klinker = true, inOpening = true) {
    const start = code.indexOf('// --- KORRIGIERTE STURZBLENDEN & PU-BLENDEN LOGIK ---');
    const end = code.indexOf('calculatedProposals = proposals.map', start);
    assert.ok(start >= 0 && end > start);
    const context = {
        B, klinkerO: top, isKlinkerMontage: klinker, isMontageIn: inOpening,
        proposals: [{ w: 2750, h, type: 'Z-Beschlag' }]
    };
    vm.runInNewContext(code.slice(start, end), context);
    return JSON.parse(JSON.stringify(context.proposals));
}

for (const [delta, fascia, pu] of [
    [100, null, false], [125, 95, false], [180, 95, false],
    [181, 125, false], [210, 125, false], [211, 211, true]
]) {
    const [p] = calculate(source, 2500 + delta, 0, 2500);
    assert.equal(p.fascia, fascia, `difference ${delta}`);
    assert.equal(p.isPU, pu, `PU at difference ${delta}`);
}
assert.equal(calculate(source, 2711, 1, 2500)[0].fascia, 125);
assert.equal(calculate(source, 2711, 1, 2500)[0].isPU, false);
assert.equal(calculate(source, 2125, 0, 2000)[0].fascia, 95);
assert.equal(calculate(source, 2125, 25, 2000)[0].fascia, null);
assert.deepEqual(calculate(source, 3101, 0, 2500), []);
assert.equal(calculate(source, 3000, 0, 2500)[0].fascia, 500);

let comparisons = 0;
for (const inOpening of [false, true]) {
    for (const h of [2000, 2125, 2500, 2875, 3000, 3500, 3600]) {
        for (let delta = 0; delta <= 650; delta++) {
            assert.deepEqual(calculate(source, h + delta, 0, h, false, inOpening),
                calculate(baseline, h + delta, 0, h, false, inOpening));
            comparisons++;
        }
    }
}
console.log(`Klinker boundary cases passed; ${comparisons} unchanged other-mount comparisons passed.`);
