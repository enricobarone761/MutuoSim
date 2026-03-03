"""
Scarica i dati storici HICP (Harmonised Index of Consumer Prices) per l'Italia
da Eurostat (API REST pubblica) e li converte in tassi di inflazione mensile YoY.

Fonte: Eurostat — prc_hicp_midx
Serie: CP00 (Indice generale) — IT (Italia) — mensile, base 2015=100

Esegui per aggiornare i dati:
    python update_inflation.py
"""

import json
import urllib.request
import os
from datetime import datetime

# API Eurostat REST (formato JSON-stat2)
EUROSTAT_URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
    "prc_hicp_midx?format=JSON&lang=EN"
    "&unit=I15"          # indice base 2015=100
    "&coicop=CP00"       # indice generale
    "&geo=IT"            # Italia
    "&sinceTimePeriod=1996-01"
)

# Determina la cartella root del progetto rispetto allo script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OUTPUT_JSON = os.path.join(BASE_DIR, "data", "inflation_data.json")
OUTPUT_JS   = os.path.join(BASE_DIR, "js", "data", "inflation_data.js")


def fetch_hicp_index(url: str) -> dict[str, float]:
    """
    Scarica la serie HICP mensile da Eurostat e ritorna {"YYYY-MM": indice, ...}.
    """
    print(f"  Scaricando da Eurostat...")
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    # Struttura JSON-stat2 di Eurostat
    time_ids   = raw["dimension"]["time"]["category"]["index"]   # {"YYYY-MM": position, ...}
    values_arr = raw["value"]                                     # {str(position): float, ...}

    # Mappa posizione -> periodo
    pos_to_period = {v: k for k, v in time_ids.items()}

    data: dict[str, float] = {}
    for pos_str, val in values_arr.items():
        period = pos_to_period.get(int(pos_str))
        if period and val is not None:
            data[period] = round(float(val), 4)

    return dict(sorted(data.items()))


def index_to_yoy_rates(index_data: dict[str, float]) -> dict[str, float]:
    """
    Converte la serie di indici in tassi YoY mensili (inflazione in %).
    YoY(t) = (Index(t) / Index(t-12) - 1) * 100
    Richiede almeno 13 mesi di storico.
    """
    periods = sorted(index_data.keys())
    rates: dict[str, float] = {}

    for i, period in enumerate(periods):
        year, month = int(period[:4]), int(period[5:7])
        prev_year = year - 1
        prev_key = f"{prev_year}-{month:02d}"
        if prev_key in index_data and index_data[prev_key] > 0:
            yoy = (index_data[period] / index_data[prev_key] - 1) * 100
            rates[period] = round(yoy, 4)

    return rates


def main():
    print("=" * 55)
    print("  Aggiornamento dati Inflazione HICP Italia (Eurostat)")
    print("=" * 55)

    print("\n📥 HICP Italia (CP00, base I15):")
    index_data = fetch_hicp_index(EUROSTAT_URL)
    keys = sorted(index_data.keys())
    print(f"  ✅ {len(index_data)} mesi indice scaricati ({keys[0]} → {keys[-1]})")

    print("\n📐 Calcolo tassi YoY mensili...")
    yoy_rates = index_to_yoy_rates(index_data)
    rate_keys = sorted(yoy_rates.keys())
    print(f"  ✅ {len(yoy_rates)} tassi YoY calcolati ({rate_keys[0]} → {rate_keys[-1]})")

    result = {
        "IT_HICP_YOY": yoy_rates,
        "_meta": {
            "updated":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source":   "Eurostat — prc_hicp_midx (CP00, IT, I15)",
            "unit":     "% YoY mensile",
            "note":     "Inflazione HICP armonizzata Italia. Date future non presenti.",
        },
    }

    # Salva JSON (backup)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Salva JS (caricato dalla pagina — nessun problema CORS)
    js_content = "// Auto-generato da update_inflation.py - NON modificare manualmente\n"
    js_content += "const INFLATION_LOCAL_DATA = " + json.dumps(result, ensure_ascii=False) + ";\n"
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"\n💾 Salvato: {OUTPUT_JSON}")
    print(f"💾 Salvato: {OUTPUT_JS}")
    print(f"📅 Ultimo aggiornamento: {result['_meta']['updated']}")
    print("=" * 55)


if __name__ == "__main__":
    main()
