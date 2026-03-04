describe('Utility functions', () => {
    it('fmtCurr formatta correttamente la valuta in Euro (IT)', () => {
        const formatted = fmtCurr(1234.56);
        // Controlliamo che ci siano le cifre corrette con la punteggiatura it-IT.
        // Usiamo un replace per rimuovere eventuali spazi/NBSP generati da Intl in brower diversi.
        const cleanForm = formatted.replace(/\s|[\\u202F\\u00A0]/g, '');
        expect(cleanForm.includes('1.234,56')).toBeTruthy();
        expect(cleanForm.includes('€')).toBeTruthy();
    });
});
