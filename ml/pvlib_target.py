# ml/pvlib_target.py
import pandas as pd
import pvlib
import numpy as np


def add_pvlib_prod_kwh(
    df,
    lat,
    lon,
    area_m2=1.0,
    eff=0.18,
    tilt=20,
    azimuth=180,
    tz="UTC",
):
    """
    Use PVLib to simulate daily AC energy (kWh) from NASA POWER weather.

    Assumptions:
      - df has:
          * 'date' column (daily timestamps)
          * 'ALLSKY_SFC_SW_DWN' : daily GHI in kWh/m²/day (NASA POWER)
          * optional 'T2M'      : air temperature (°C)
          * optional 'WS2M'     : wind speed (m/s)
      - We build a flat 24-hour profile from daily GHI and create simple DNI/DHI:
          dni ≈ 0.8 * ghi,  dhi ≈ 0.2 * ghi.

    Output:
      - Adds/overwrites: df['prod_kwh']  (PVLib-based daily AC energy in kWh)
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])

    if "ALLSKY_SFC_SW_DWN" not in df.columns:
        raise KeyError("DataFrame must contain 'ALLSKY_SFC_SW_DWN' from NASA POWER.")

    # rough DC capacity (kW): area * eff * 1 kW/m² at STC
    capacity_kw = float(area_m2) * float(eff)

    lat = float(lat)
    lon = float(lon)

    # Location
    location = pvlib.location.Location(latitude=lat, longitude=lon, tz=tz)

    # Simple PVWatts-style system
    module_params = {"pdc0": capacity_kw * 1000, "gamma_pdc": -0.004}
    inverter_params = {"pdc0": capacity_kw * 1000}

    system = pvlib.pvsystem.PVSystem(
        surface_tilt=float(tilt),
        surface_azimuth=float(azimuth),
        module_parameters=module_params,
        inverter_parameters=inverter_params,
        racking_model="open_rack",
        module_type="glass_polymer",
    )

    # ModelChain using PVWatts DC/AC.
    # IMPORTANT: do NOT pass temperature_model="infer" for your pvlib version.
    mc = pvlib.modelchain.ModelChain(
        system,
        location,
        dc_model="pvwatts",
        ac_model="pvwatts",
        aoi_model="no_loss",
        spectral_model="no_loss",
    )

    ghi_daily = df["ALLSKY_SFC_SW_DWN"].astype(float)

    all_times = []
    all_ghi = []
    all_dni = []
    all_dhi = []
    all_temp = []
    all_wind = []

    for date, ghi_kwh in zip(df["date"], ghi_daily):
        if np.isnan(ghi_kwh):
            continue

        # Convert daily kWh/m² to average W/m² over 24h:
        # P_avg (W/m²) = (kWh/m²/day * 1000 W/kW) / 24 h
        p_avg_wm2 = ghi_kwh * 1000.0 / 24.0

        for h in range(24):
            t = pd.Timestamp(date) + pd.Timedelta(hours=h)
            all_times.append(t)

            ghi = p_avg_wm2
            dni = ghi * 0.8
            dhi = ghi * 0.2

            all_ghi.append(ghi)
            all_dni.append(dni)
            all_dhi.append(dhi)

            if "T2M" in df.columns:
                all_temp.append(df.loc[df["date"] == date, "T2M"].iloc[0])
            else:
                all_temp.append(25.0)

            if "WS2M" in df.columns:
                all_wind.append(df.loc[df["date"] == date, "WS2M"].iloc[0])
            else:
                all_wind.append(1.0)

    if not all_times:
        raise ValueError("No valid GHI data to build PVLib target.")

    # Safe timezone handling
    times = pd.DatetimeIndex(pd.to_datetime(all_times))
    if times.tz is None:
        times = times.tz_localize(tz)
    else:
        times = times.tz_convert(tz)

    weather = pd.DataFrame(
        {
            "ghi": all_ghi,
            "dni": all_dni,
            "dhi": all_dhi,
            "temp_air": all_temp,
            "wind_speed": all_wind,
        },
        index=times,
    )

    # Run modelchain; depending on pvlib version, AC results may live in different places
    res = mc.run_model(weather)

    # Try multiple ways to get AC power
    ac = getattr(mc, "ac", None)
    if ac is None:
        ac = getattr(res, "ac", None)
    if ac is None:
        # Some older versions store results in mc.results
        maybe_results = getattr(mc, "results", None)
        if maybe_results is not None and hasattr(maybe_results, "ac"):
            ac = maybe_results.ac

    if ac is None:
        raise ValueError("PVLib ModelChain did not expose 'ac' attribute. "
                         "Check pvlib version or modelchain configuration.")

    # ac is W, convert to kW and integrate over day
    ac_kw = ac / 1000.0  # kW
    daily_energy = ac_kw.resample("D").sum()  # kWh/day

    # Align back to df dates; missing days -> 0
    daily_energy = daily_energy.reindex(df["date"].dt.floor("D")).fillna(0.0).values
    df["prod_kwh"] = daily_energy

    return df
