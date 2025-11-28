import pandas as pd
import numpy as np

def estimate_hourly_production(df, panel_area_m2=1.0, efficiency=0.18):
    """
    Convert NASA POWER hourly irradiance (W/m²) into hourly energy (kWh).
    """
    if 'ALLSKY_SFC_SW_DWN' not in df.columns:
        df['prod_kwh'] = np.nan
        return df
    
    ghi = df['ALLSKY_SFC_SW_DWN'].astype(float)

    # convert to kWh per hour
    df['prod_kwh'] = (ghi * panel_area_m2 * efficiency) / 1000.0
    return df


def add_hourly_features(df):
    """
    Add rolling/lag features suitable for hourly ML forecasting.
    """
    df = df.sort_values('date')

    df['hour'] = df['date'].dt.hour
    df['dayofyear'] = df['date'].dt.dayofyear

    df['prod_lag1'] = df['prod_kwh'].shift(1)
    df['prod_ma3'] = df['prod_kwh'].rolling(3, min_periods=1).mean().shift(1)
    df['prod_ma24'] = df['prod_kwh'].rolling(24, min_periods=1).mean().shift(1)

    df = df.dropna(subset=['prod_lag1'])

    return df
