# # ml/ingest_nasa.py
# import requests
# import pandas as pd
# from datetime import datetime, timedelta, timezone

# BASE = "https://power.larc.nasa.gov/api/temporal/hourly/point"

# def fetch_nasa_power(lat, lon, start, end, params=None):
#     # CLD parameter doesn't exist in NASA POWER API - removed it
#     params = params or ["ALLSKY_SFC_SW_DWN", "T2M", "RH2M"]
#     var_str = ",".join(params)
#     url = f"{BASE}?start={start}&end={end}&latitude={lat}&longitude={lon}&community=RE&parameters={var_str}&format=JSON"
    
#     r = requests.get(url, timeout=30)
#     r.raise_for_status()
#     data = r.json()
#     days = data["properties"]["parameter"]
#     df = pd.DataFrame(days)
#     df.index = pd.to_datetime(df.index)
#     df = df.reset_index().rename(columns={"index":"date"})
    
#     # Add dummy CLD column since the model expects it
#     df['CLD'] = 50.0  # Default 50% cloud cover
    
#     return df

# if __name__ == "__main__":
#     end = (datetime.now(timezone.utc) - timedelta(days=90)).date()
#     start = end - timedelta(days=60)
#     df = fetch_nasa_power(28.6139, 77.2090, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
#     print(df.head().to_json(orient='records'))

# ml/ingest_nasa.py
import requests
import pandas as pd
from datetime import datetime, timedelta, timezone

BASE = "https://power.larc.nasa.gov/api/temporal/hourly/point"

def fetch_nasa_power(lat, lon, start, end, params=None):
    """
    Fetch HOURLY NASA POWER data for given lat/lon and date range.

    - Uses temporal=hourly endpoint.
    - Index keys are like '2025101200' (YYYYMMDDHH), so we parse with format='%Y%m%d%H'.
    """
    params = params or ["ALLSKY_SFC_SW_DWN", "T2M", "RH2M"]
    var_str = ",".join(params)

    url = (
        f"{BASE}"
        f"?start={start}&end={end}"
        f"&latitude={lat}&longitude={lon}"
        f"&community=RE&parameters={var_str}&format=JSON"
    )

    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()

    # data["properties"]["parameter"] is a dict:
    # { "ALLSKY_SFC_SW_DWN": { "2025101200": val, ... },
    #   "T2M":               { "2025101200": val, ... },
    #   "RH2M":              { "2025101200": val, ... } }
    params_dict = data["properties"]["parameter"]

    df = pd.DataFrame(params_dict)

    # index is strings like '2025101200' (YYYYMMDDHH)
    idx_str = df.index.astype(str)

    # parse explicitly as YYYYMMDDHH
    df.index = pd.to_datetime(idx_str, format="%Y%m%d%H")

    df = df.reset_index().rename(columns={"index": "date"})

    # Add dummy CLD column since the model expects it
    df["CLD"] = 50.0  # Default 50% cloud cover

    return df


if __name__ == "__main__":
    end = (datetime.now(timezone.utc) - timedelta(days=90)).date()
    start = end - timedelta(days=60)
    df = fetch_nasa_power(28.6139, 77.2090, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
    print(df.head().to_json(orient="records"))
