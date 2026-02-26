/**
 * ===========================================================================
 *  MutuoSim — utils.js
 * ===========================================================================
 *  Funzioni di utilità generiche per formattazione e stile UI.
 */

/**
 * Formatta un valore numerico come valuta EUR in formato italiano.
 * @param {number} val - Importo da formattare
 * @returns {string} Stringa formattata con simbolo €
 */
function fmtCurr(val) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
    }).format(val);
}

/**
 * Applica uno stile dinamico allo slider (effetto "volume bar").
 * @param {HTMLInputElement} slider - Elemento <input type="range">
 */
function updateSliderFill(slider) {
    if (!slider) return;
    const val = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    // Colore viola accent di MutuoSim: #8b5cf6
    slider.style.background = `linear-gradient(to right, #8b5cf6 ${val}%, rgba(255, 255, 255, 0.1) ${val}%)`;
}
