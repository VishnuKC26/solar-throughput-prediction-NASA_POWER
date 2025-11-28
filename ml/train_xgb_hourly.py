# ml/train_xgb_hourly.py
import argparse
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import VotingRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
from sklearn.ensemble import RandomForestRegressor

from ingest_nasa import fetch_nasa_power


class HourlySolarValidator:
    def __init__(self):
        self.model = None
        self.results = {}

    def create_ensemble_model(self):
        m1 = XGBRegressor(
            n_estimators=200,
            learning_rate=0.05,
            random_state=42,
            objective="reg:squarederror",
        )
        m2 = LGBMRegressor(
            n_estimators=200,
            learning_rate=0.05,
            random_state=42,
            verbose=-1,
        )
        m3 = RandomForestRegressor(
            n_estimators=200,
            max_depth=15,
            random_state=42,
        )
        return VotingRegressor(
            [
                ("xgb", m1),
                ("lgbm", m2),
                ("rf", m3),
            ]
        )

    def time_split_data(self, df, train_ratio=0.8):
        split_point = int(len(df) * train_ratio)
        train_df = df.iloc[:split_point].copy()
        test_df = df.iloc[split_point:].copy()

        print("\n📅 Data Split (HOURLY):")
        print(f"   Training: {train_df['date'].min()} -> {train_df['date'].max()} ({len(train_df)} hours)")
        print(f"   Testing:  {test_df['date'].min()} -> {test_df['date'].max()} ({len(test_df)} hours)")

        return train_df, test_df

    def calculate_baseline(self, train_df, test_df, target_col="target"):
        mean_train = float(train_df[target_col].mean())
        baseline_pred = np.full(len(test_df), mean_train)
        actual = test_df[target_col].values
        mae_baseline = mean_absolute_error(actual, baseline_pred)
        return baseline_pred, mae_baseline, mean_train

    def train_and_evaluate(self, df, features, target="target"):
        print("\n" + "=" * 60)
        print("🔍 HOURLY MODEL VALIDATION (target: next hour est_kwh_hour)")
        print("=" * 60)

        train_df, test_df = self.time_split_data(df)

        X_train = train_df[features].values
        y_train = train_df[target].values
        X_test = test_df[features].values
        y_test = test_df[target].values

        train_mask = ~np.isnan(X_train).any(axis=1) & ~np.isnan(y_train)
        test_mask = ~np.isnan(X_test).any(axis=1) & ~np.isnan(y_test)

        X_train = X_train[train_mask]
        y_train = y_train[train_mask]
        X_test = X_test[test_mask]
        y_test = y_test[test_mask]

        print(f"\n✅ Clean data: {len(X_train)} train hours, {len(X_test)} test hours")

        print("\n🤖 Training ensemble model (XGB + LGBM + RF)...")
        self.model = self.create_ensemble_model()
        self.model.fit(X_train, y_train)
        print("   ✓ Training complete!")

        y_pred = self.model.predict(X_test)

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        mape = float(np.mean(np.abs((y_test - y_pred) / (y_test + 1e-8))) * 100.0)

        mean_level = float(train_df[target].mean())
        nmae = float(mae / (mean_level + 1e-8) * 100.0)

        baseline_pred, mae_baseline, baseline_mean = self.calculate_baseline(
            train_df, test_df[test_mask], target_col=target
        )
        improvement = ((mae_baseline - mae) / mae_baseline) * 100.0 if mae_baseline != 0 else 0.0

        self.results = {
            "ensemble_model": {
                "MAE": float(mae),
                "RMSE": float(rmse),
                "R2": float(r2),
                "MAPE": float(mape),
                "NMAE_percent_of_mean": float(nmae),
            },
            "baseline": {
                "MAE": float(mae_baseline),
                "baseline_type": "train_mean_climatology_hourly",
                "baseline_mean": float(baseline_mean),
            },
            "improvement_percent_vs_baseline": float(improvement),
            "test_samples": int(len(y_test)),
            "train_samples": int(len(y_train)),
        }

        self.print_results()
        return y_test, y_pred, baseline_pred

    def print_results(self):
        print("\n" + "=" * 60)
        print("📊 HOURLY VALIDATION RESULTS")
        print("=" * 60)

        em = self.results["ensemble_model"]
        bl = self.results["baseline"]
        imp = self.results["improvement_percent_vs_baseline"]

        print("\n🤖 Ensemble Model Performance (hourly):")
        print(f"   MAE:                     {em['MAE']:.4f} kWh/hour")
        print(f"   RMSE:                    {em['RMSE']:.4f} kWh/hour")
        print(f"   R²:                      {em['R2']:.3f}")
        print(f"   MAPE:                    {em['MAPE']:.1f}%")
        print(f"   NMAE (% of mean output): {em['NMAE_percent_of_mean']:.1f}%")

        print("\n📌 Baseline (climatology: mean hourly target):")
        print(f"   Baseline MAE:            {bl['MAE']:.4f} kWh/hour")
        print(f"   Baseline mean output:    {bl['baseline_mean']:.4f} kWh/hour")

        print("\n✨ Improvement vs baseline:")
        print(f"   MAE improvement:         {imp:.1f}%")

        if imp > 0:
            print("   ✓ Model is better than climatology baseline.")
        else:
            print("   ⚠️ Model not better than baseline (could need richer features / more data).")

        print("\n" + "=" * 60)

    def save_model_and_report(self, model_path="ensemble_model_hourly.joblib", report_path="validation_report_hourly.json"):
        joblib.dump(self.model, model_path)
        print(f"\n💾 Model saved: {model_path}")

        with open(report_path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"📄 Hourly report saved: {report_path}")


def main(lat, lon, area, eff):
    print("\n🌞 SOLAR POWER PREDICTION - HOURLY VALIDATION")
    print(f"Location: ({lat}, {lon})")
    print(f"Panel: {area} m², {float(eff)*100:.1f}% efficiency")

    print("\n📥 Fetching hourly NASA POWER data...")
    today = datetime.now(timezone.utc).date()

    df = None
    for days_back in [3, 7, 14]:
        try:
            end = today - timedelta(days=days_back)
            start = end - timedelta(days=30)
            df = fetch_nasa_power(lat, lon, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
            if df is not None and not df.empty:
                print(f"   ✓ Got hourly-like data ending {days_back} days ago")
                break
        except Exception as e:
            if days_back == 14:
                print(f"   ✗ Error fetching NASA POWER hourly data: {e}")
                return
            continue

    if df is None or df.empty:
        print("   ✗ No data available")
        return

    # ---------- CORE HOURLY PHYSICS + FEATURES (no external helpers) ----------
    print("\n🔧 Creating hourly features...")

    # 1) Ensure date is proper datetime
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    # 2) Compute est_kwh_hour from hourly GHI in W/m²
    if "ALLSKY_SFC_SW_DWN" not in df.columns:
        raise KeyError(f"ALLSKY_SFC_SW_DWN not in columns: {list(df.columns)}")

    ghi = df["ALLSKY_SFC_SW_DWN"].astype(float)
    area_f = float(area)
    eff_f = float(eff)
    pr = 0.75  # performance ratio
    est = (ghi * area_f * eff_f * pr) / 1000.0
    est = est.clip(lower=0.0)
    df["est_kwh_hour"] = est

    # 3) Time features
    df["hour"] = df["date"].dt.hour
    df["dayofyear"] = df["date"].dt.dayofyear

    # 4) Rolling features
    df["prod_lag_1h"] = df["est_kwh_hour"].shift(1)
    df["prod_ma_6h"] = df["est_kwh_hour"].rolling(6, min_periods=1).mean().shift(1)
    df["prod_ma_24h"] = df["est_kwh_hour"].rolling(24, min_periods=1).mean().shift(1)

    # 5) Define target: next hour's energy
    df["target"] = df["est_kwh_hour"].shift(-1)

    # 6) Drop missing
    features = [
        "hour",
        "dayofyear",
        "prod_lag_1h",
        "prod_ma_6h",
        "prod_ma_24h",
        "T2M",
        "CLD",
        "RH2M",
    ]
    subset_cols = features + ["target"]
    df = df.dropna(subset=subset_cols)

    print(f"   ✓ {len(df)} hourly samples after cleaning")

    # -------------------------------------------------------------------------

    validator = HourlySolarValidator()
    y_test, y_pred, baseline_pred = validator.train_and_evaluate(df, features, target="target")

    validator.save_model_and_report()

    print("\n✅ HOURLY VALIDATION COMPLETE!\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate solar prediction model on HOURLY data")
    parser.add_argument("--lat", required=True, help="Latitude")
    parser.add_argument("--lon", required=True, help="Longitude")
    parser.add_argument("--area", default=1.0, help="Solar panel area (m²)")
    parser.add_argument("--eff", default=0.18, help="Panel efficiency (0-1)")
    args = parser.parse_args()
    main(args.lat, args.lon, args.area, args.eff)
