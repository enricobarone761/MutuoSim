/**
 * Simple Vanilla Test Runner for MutuoSim
 */

const TinyTest = {
    results: [],
    currentGroup: '',

    describe(name, fn) {
        this.currentGroup = name;
        fn();
    },

    it(name, fn) {
        try {
            fn();
            this.results.push({ group: this.currentGroup, name, status: 'pass' });
        } catch (e) {
            this.results.push({ group: this.currentGroup, name, status: 'fail', error: e.message });
            console.error(`FAIL: ${this.currentGroup} > ${name}\n`, e);
        }
    },

    expect(actual) {
        return {
            toBe(expected) {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected} but got ${actual}`);
                }
            },
            toBeCloseTo(expected, precision = 2) {
                if (Math.abs(actual - expected) > Math.pow(10, -precision) / 2) {
                    throw new Error(`Expected ${actual} to be close to ${expected} (precision: ${precision})`);
                }
            },
            toBeTruthy() {
                if (!actual) {
                    throw new Error(`Expected ${actual} to be truthy`);
                }
            },
            toBeFalsy() {
                if (actual) {
                    throw new Error(`Expected ${actual} to be falsy`);
                }
            }
        };
    },

    render() {
        const container = document.getElementById('test-results');
        if (!container) return;

        let html = '';
        let currentGroup = '';

        this.results.forEach(res => {
            if (res.group !== currentGroup) {
                currentGroup = res.group;
                html += `<h2 class="group-title">${currentGroup}</h2>`;
            }
            const statusClass = res.status === 'pass' ? 'pass' : 'fail';
            const icon = res.status === 'pass' ? '✅' : '❌';
            html += `
                <div class="test-item ${statusClass}">
                    <span>${icon} ${res.name}</span>
                    ${res.error ? `<div class="error-msg">${res.error}</div>` : ''}
                </div>
            `;
        });

        const passed = this.results.filter(r => r.status === 'pass').length;
        const total = this.results.length;

        const summaryHtml = `
            <div class="summary ${passed === total ? 'all-pass' : 'some-fail'}">
                ${passed} / ${total} test superati
            </div>
        `;

        container.innerHTML = summaryHtml + html;
    }
};

window.describe = TinyTest.describe.bind(TinyTest);
window.it = TinyTest.it.bind(TinyTest);
window.expect = TinyTest.expect.bind(TinyTest);
window.TinyTest = TinyTest;
