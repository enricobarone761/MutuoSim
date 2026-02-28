# MutuoSim 🏠

**MutuoSim** è un calcolatore avanzato per mutui progettato per simulare scenari complessi, inclusi tassi variabili manuali, estinzioni parziali e simulazioni basate su dati Euribor storici reali.

## 🚀 Funzionalità Principali

- **Calcolo Standard**: Simulazione di mutui a tasso fisso con ammortamento alla francese.
- **Scenario Variabile Manuale**: Possibilità di definire intervalli temporali futuri con tassi di interesse personalizzati per simulare l'andamento del mercato.
- **Simulazione Euribor**: Utilizzo di dati storici reali dell'Euribor (1M o 3M) forniti dalla BCE per vedere come si sarebbe comportato il mutuo in passato.
- **Estinzioni Parziali Avanzate**:
    - Frequenza personalizzabile (Una tantum, Mensile, Trimestrale, Semestrale, Annuale).
    - Scelta del periodo di inizio e della durata dell'extrapagamento.
    - Opzione tra **Riduci Durata** o **Riduci Rata**.
- **Arrotondamento Rata**: Funzione per arrotondare la rata mensile a una cifra tonda superiore, applicando automaticamente la differenza come mini-estinzione parziale.
- **Analisi di Sensibilità**: Tabella interattiva che mostra come varia la rata al variare del tasso (±0.5%) e della durata (±5 anni).
- **Grafico Interattivo**: Visualizzazione dinamica del debito residuo, della quota interessi cumulativa, della rata mensile e dei tassi applicati.
- **Analisi Risparmio**: Box riassuntivo che evidenzia il tempo risparmiato e il risparmio totale sugli interessi grazie alle estinzioni parziali.

## ✨ Funzionalità Avanzate (Sidebar Destra)

- **Costi Iniziali e TAEG**: Inserimento di spese di istruttoria, perizia, notaio e imposta sostitutiva con calcolo automatico del TAEG stimato (IRR).
- **Detrazioni Fiscali**: Calcolo del recupero IRPEF del 19% sugli interessi passivi (fino a 4000€ annui).
- **Investimento Alternativo**: Confronto matematico tra l'estinzione anticipata e l'investimento degli stessi capitali in un prodotto finanziario (es. ETF/PAC).
- **Indicatore LTV (Loan-To-Value)**: Rapporto tra debito residuo e valore dell'immobile, con soglie di rischio (60%, 80%) per valutare surroghe.
- **Sostenibilità DTI (Debt-to-Income)**: Analisi del rapporto rata/reddito con avvisi visivi se supera la soglia del 33%.
- **Heatmap Interessi**: Visualizzazione grafica del peso degli interessi anno per anno.
- **Salvataggio Scenari**: Possibilità di salvare e caricare due diverse simulazioni per confrontarle rapidamente.
- **Tooltip Informativi**: Spiegazioni dettagliate per ogni parametro tramite icone "i" interattive.

## 🛠️ Utilizzo Generale

1. Apri `mortage.html` in un browser.
2. Inserisci i parametri del mutuo (Importo, Durata, Tasso Base).
3. Attiva lo **Scenario Variabile Manuale** o la **Simulazione Euribor** tramite i toggle laterali per analisi più complesse.
4. Sperimenta con le **Estinzioni Parziali** per vedere l'impatto sul piano di ammortamento.
5. Usa il tasto **"Avanzate & Analisi"** per accedere agli strumenti di calcolo dei costi accessori e comparazione finanziaria.

## 📈 Aggiornamento Dati Euribor

Il progetto include uno script Python per scaricare gli ultimi dati Euribor dalla Banca Centrale Europea (BCE).

Per aggiornare i dati:
1. Assicurati di avere Python installato.
2. Esegui lo script:
   ```bash
   python scripts/update_euribor.py
   ```
Lo script aggiornerà i dati nelle cartelle `data/` e `js/data/` utilizzati dall'applicazione.

---
**Disclaimer**: *MutuoSim è uno strumento di simulazione a scopo puramente informativo e non costituisce consulenza finanziaria. I calcoli, sebbene accurati, possono differire da quelli reali della banca a causa di arrotondamenti o criteri specifici degli istituti. L'utente è l'unico responsabile delle proprie decisioni finanziarie. Verifica sempre le condizioni contrattuali ufficiali con il tuo istituto di credito.*
