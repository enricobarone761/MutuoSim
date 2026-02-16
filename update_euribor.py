"""
Scarica i dati storici Euribor 1M e 3M dalla BCE e li salva come file JSON locali.
Esegui questo script ogni volta che vuoi aggiornare i dati:
    python update_euribor.py
"""

import json
import urllib.request
from datetime import datetime

# URL API BCE (formato SDMX-JSON)
ECB_URLS = {
    "1M": "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1MD_.HSTA?format=jsondata&startPeriod=1999-01",
    "3M": "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?format=jsondata&startPeriod=1999-01",
}

OUTPUT_JSON = "euribor_data.json"
OUTPUT_JS = "euribor_data.js"


def fetch_ecb_series(url: str) -> dict[str, float]:
    """Scarica una serie storica dalla BCE e ritorna {\"YYYY-MM\": tasso, ...}."""
    print(f"  Scaricando da: {url[:80]}...")
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    observations = raw["dataSets"][0]["series"]["0:0:0:0:0:0:0"]["observations"]
    time_periods = raw["structure"]["dimensions"]["observation"][0]["values"]

    data: dict[str, float] = {}
    for idx_str, obs in observations.items():
        period = time_periods[int(idx_str)]["id"]  # "YYYY-MM"
        rate = obs[0]
        if rate is not None:
            data[period] = round(rate, 4)

    return dict(sorted(data.items()))


def main():
    print("=" * 50)
    print("  Aggiornamento dati Euribor dalla BCE")
    print("=" * 50)

    result = {}

    for tenor, url in ECB_URLS.items():
        print(f"\n📥 Euribor {tenor}:")
        series = fetch_ecb_series(url)
        keys = sorted(series.keys())
        print(f"  ✅ {len(series)} mesi scaricati ({keys[0]} → {keys[-1]})")
        result[tenor] = series

    # Aggiungi metadata
    result["_meta"] = {
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": "BCE (European Central Bank)",
        "unit": "% annuo",
    }

    # Salva JSON (backup)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Salva JS (usato dalla pagina - nessun problema CORS)
    js_content = "// Auto-generato da update_euribor.py - NON modificare manualmente\n"
    js_content += "const EURIBOR_LOCAL_DATA = " + json.dumps(result, ensure_ascii=False) + ";\n"
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"\n💾 Salvato: {OUTPUT_JSON} + {OUTPUT_JS}")
    print(f"📅 Ultimo aggiornamento: {result['_meta']['updated']}")
    print("=" * 50)


if __name__ == "__main__":
    main()
