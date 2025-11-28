# # ml/features.py
# import pandas as pd
# import numpy as np

# def estimate_production_from_irradiance(df, panel_area_m2=1.0, efficiency=0.18, pr=0.75):
#     if 'ALLSKY_SFC_SW_DWN' in df.columns:
#         vals = df['ALLSKY_SFC_SW_DWN'].astype(float)
#         if vals.mean() < 50:
#             df['est_kwh'] = vals * panel_area_m2 * efficiency * pr
#         else:
#             df['est_kwh'] = vals * 24.0 / 1000.0 * panel_area_m2 * efficiency * pr
#     else:
#         df['est_kwh'] = np.nan
#     return df

# def add_time_and_rolling(df):
#     df['date'] = pd.to_datetime(df['date'])
#     df = df.sort_values('date')
#     df['dayofyear'] = df['date'].dt.dayofyear
#     df['prod_lag1'] = df['est_kwh'].shift(1)
#     df['prod_ma3'] = df['est_kwh'].rolling(3, min_periods=1).mean().shift(1)
#     df['prod_ma7'] = df['est_kwh'].rolling(7, min_periods=1).mean().shift(1)
#     df = df.dropna(subset=['prod_lag1'])
#     return df
# ml/features.py  (replace existing functions with the block below)
import pandas as pd
import numpy as np

def estimate_production_from_irradiance(df, panel_area_m2=1.0, efficiency=0.18, pr=0.75):
    """
    Convert NASA DAILY GHI (kWh/m²/day) into site daily energy (kWh/day).
    - Assumes ALLSKY_SFC_SW_DWN from daily endpoint is in kWh/m²/day.
    - Clips negatives to 0 and removes extreme outliers.
    """
    df = df.copy()
    if 'ALLSKY_SFC_SW_DWN' not in df.columns:
        df['est_kwh'] = np.nan
        return df

    # Safe numeric cast
    ghi = pd.to_numeric(df['ALLSKY_SFC_SW_DWN'], errors='coerce').fillna(0.0)

    # physical conversion: kWh/m²/day * area * efficiency * performance_ratio => kWh/day
    est = ghi * float(panel_area_m2) * float(efficiency) * float(pr)

    # Clip negative values to 0 (night / bad data)
    est = est.clip(lower=0.0)

    # Optional: remove unrealistically large outliers by capping to, say, 3 * 99th percentile
    cap = max(est.quantile(0.99) * 3.0, est.mean() * 10.0, 1e6)
    est = est.clip(upper=cap)

    df['est_kwh'] = est
    return df


def add_time_and_rolling(df):
    """
    Build daily lag/rolling features from est_kwh.
    """
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    df['dayofyear'] = df['date'].dt.dayofyear
    df['prod_lag1'] = df['est_kwh'].shift(1)
    df['prod_ma3'] = df['est_kwh'].rolling(3, min_periods=1).mean().shift(1)
    df['prod_ma7'] = df['est_kwh'].rolling(7, min_periods=1).mean().shift(1)

    # drop rows where lag is missing or target can't be computed
    df = df.dropna(subset=['prod_lag1'])
    return df
