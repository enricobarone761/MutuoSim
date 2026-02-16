---
description: Aggiorna i dati storici Euribor dalla BCE
---

## Aggiorna Dati Euribor

Questo workflow scarica i dati Euribor aggiornati dalla BCE e li salva nel file `euribor_data.json`.

// turbo-all

### Steps

1. Esegui lo script Python per scaricare i dati aggiornati:
```
python update_euribor.py
```
Directory: `c:\Users\enrib\Desktop\e`

Lo script scarica automaticamente Euribor 1M e 3M dalla API della BCE e sovrascrive il file `euribor_data.json`.

2. Verifica che il file sia stato aggiornato controllando la data nell'output dello script.
