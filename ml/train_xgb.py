import argparse
import joblib
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import VotingRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
from sklearn.ensemble import RandomForestRegressor

from ingest_nasa import fetch_nasa_power
from features import estimate_production_from_irradiance, add_time_and_rolling


class SimpleSolarValidator:
    """
    Simple and logical validation:
    1. Split data by time (80% train, 20% test)
    2. Train on past data
    3. Test on future data
    4. Compare with a simple climatology baseline (historical mean)
    """

    def __init__(self):
        self.model = None
        self.results = {}

    def create_ensemble_model(self):
        """
        Simple ensemble: average predictions from 3 models.
        """
        model1 = XGBRegressor(
            n_estimators=100,
            learning_rate=0.1,
            random_state=42,
            objective="reg:squarederror",
        )
        model2 = LGBMRegressor(
            n_estimators=100,
            learning_rate=0.1,
            random_state=42,
            verbose=-1,
        )
        model3 = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
        )

        ensemble = VotingRegressor(
            [
                ("xgboost", model1),
                ("lightgbm", model2),
                ("random_forest", model3),
            ]
        )
        return ensemble

    def time_split_data(self, df, train_ratio=0.8):
        """
        Split data chronologically:
        - First 80% for training
        - Last 20% for testing (simulates future predictions)
        """
        split_point = int(len(df) * train_ratio)

        train_df = df.iloc[:split_point].copy()
        test_df = df.iloc[split_point:].copy()

        print("\n📅 Data Split:")
        print(f"   Training: {train_df['date'].min()} to {train_df['date'].max()} ({len(train_df)} days)")
        print(f"   Testing:  {test_df['date'].min()} to {test_df['date'].max()} ({len(test_df)} days)")

        return train_df, test_df

    def calculate_baseline(self, train_df, test_df, target_col="est_kwh"):
        """
        Baseline = simple climatology:
        always predict the historical mean of the target on the train period.

        This answers:
        "What if we just always predict typical daily production?"
        """
        mean_train_value = float(train_df[target_col].mean())
        baseline_predictions = np.full(len(test_df), mean_train_value)

        actual = test_df[target_col].values
        mae_baseline = mean_absolute_error(actual, baseline_predictions)
        return baseline_predictions, mae_baseline, mean_train_value

    def train_and_evaluate(self, df, features, target="est_kwh"):
        """
        Main validation logic:
        1. Split by time
        2. Train ensemble
        3. Predict future
        4. Compare to climatology baseline
        """
        print("\n" + "=" * 60)
        print("🔍 SIMPLE MODEL VALIDATION (target: est_kwh)")
        print("=" * 60)

        # 1) Split
        train_df, test_df = self.time_split_data(df)

        # 2) Prepare feature matrices
        X_train = train_df[features].values
        y_train = train_df[target].values
        X_test = test_df[features].values
        y_test = test_df[target].values

        # Remove NaNs
        train_mask = ~np.isnan(X_train).any(axis=1) & ~np.isnan(y_train)
        test_mask = ~np.isnan(X_test).any(axis=1) & ~np.isnan(y_test)

        X_train = X_train[train_mask]
        y_train = y_train[train_mask]
        X_test = X_test[test_mask]
        y_test = y_test[test_mask]

        print(f"\n✅ Clean data: {len(X_train)} training samples, {len(X_test)} test samples")

        # 3) Train ensemble
        print("\n🤖 Training ensemble model (XGBoost + LightGBM + RandomForest)...")
        self.model = self.create_ensemble_model()
        self.model.fit(X_train, y_train)
        print("   ✓ Training complete!")

        # 4) Predictions
        y_pred = self.model.predict(X_test)

        # 5) Metrics
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        # avoid blow-up when values are small
        # SMAPE: handles zeros well
        mape = float(
            np.mean(
                2 * np.abs(y_pred - y_test) /
                (np.abs(y_pred) + np.abs(y_test) + 1e-8)
            ) * 100.0
        )


        mean_level = float(train_df[target].mean())
        nmae = float(mae / (mean_level + 1e-8) * 100.0)  # MAE as % of typical daily production

        # 6) Baseline (climatology)
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
                "NMAE_percent_of_mean": nmae,
            },
            "baseline": {
                "MAE": float(mae_baseline),
                "baseline_type": "train_mean_climatology",
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
        print("📊 VALIDATION RESULTS (target: est_kwh)")
        print("=" * 60)

        em = self.results["ensemble_model"]
        bl = self.results["baseline"]
        imp = self.results["improvement_percent_vs_baseline"]

        print("\n🤖 Ensemble Model Performance:")
        print(f"   MAE (Mean Absolute Error):      {em['MAE']:.3f} kWh")
        print(f"   RMSE (Root Mean Squared):       {em['RMSE']:.3f} kWh")
        print(f"   R² (Variance Explained):        {em['R2']:.3f}")
        print(f"   MAPE (Mean Abs % Error):       {em['MAPE']:.1f}%")
        print(f"   NMAE (as % of mean output):    {em['NMAE_percent_of_mean']:.1f}%")

        print("\n📌 Baseline (climatology: train mean est_kwh):")
        print(f"   Baseline MAE:                   {bl['MAE']:.3f} kWh")
        print(f"   Baseline mean daily output:     {bl['baseline_mean']:.3f} kWh")

        print("\n✨ Improvement vs baseline:")
        print(f"   MAE improvement:                {imp:.1f}%")

        if imp > 0:
            print("   ✓ Model is better than a simple climatology baseline.")
        else:
            print("   ⚠️ Model not better than climatology baseline (time series may be very smooth).")

        print("\n" + "=" * 60)

    def save_model_and_report(self, model_path="ensemble_model.joblib", report_path="validation_report.json"):
        joblib.dump(self.model, model_path)
        print(f"\n💾 Model saved: {model_path}")

        with open(report_path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"📄 Report saved: {report_path}")


def main(lat, lon, area, eff):
    """
    Run complete validation pipeline using est_kwh as target.
    """
    print("\n🌞 SOLAR POWER PREDICTION - MODEL VALIDATION (est_kwh target)")
    print(f"Location: ({lat}, {lon})")
    print(f"Panel: {area} m², {float(eff)*100:.1f}% efficiency")

    # 1) Fetch data
    print("\n📥 Fetching historical data...")
    today = datetime.now(timezone.utc).date()

    df = None
    for days_back in [7, 14, 30, 60]:
        try:
            end = today - timedelta(days=days_back)
            start = end - timedelta(days=365)  # 1 year of data

            df = fetch_nasa_power(lat, lon, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
            if df is not None and not df.empty:
                print(f"   ✓ Got data ending {days_back} days ago")
                break
        except Exception as e:
            if days_back == 60:
                print(f"   ✗ Error fetching NASA POWER data: {e}")
                return
            continue

    if df is None or df.empty:
        print("   ✗ No data available")
        return

    # 2) Feature engineering
    print("\n🔧 Creating features...")
    df = estimate_production_from_irradiance(
        df,
        panel_area_m2=float(area),
        efficiency=float(eff),
    )
    df = add_time_and_rolling(df)

    if "dayofyear" not in df.columns:
        df["dayofyear"] = pd.to_datetime(df["date"]).dt.dayofyear

    features = ["dayofyear", "prod_lag1", "prod_ma3", "prod_ma7", "T2M", "CLD", "RH2M"]
    df = df.dropna(subset=features + ["est_kwh"])

    print(f"   ✓ {len(df)} days of clean data")
    print("\n--- DEBUG SANITY CHECKS ---")
    print("columns:", df.columns.tolist())
    print("est_kwh stats:", df["est_kwh"].describe())
    print("any negatives?", (df["est_kwh"] < 0).sum())
    print("top 10 est_kwh:", df["est_kwh"].nlargest(10).values)
    print("bottom 10 est_kwh:", df["est_kwh"].nsmallest(10).values)
    print("--- end debug ---\n")

    # 3) Validate model
    validator = SimpleSolarValidator()
    y_test, y_pred, baseline_pred = validator.train_and_evaluate(df, features, target="est_kwh")

    # 4) Save model + report
    validator.save_model_and_report()

    print("\n✅ VALIDATION COMPLETE!\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate solar prediction model (est_kwh target)")
    parser.add_argument("--lat", required=True, help="Latitude")
    parser.add_argument("--lon", required=True, help="Longitude")
    parser.add_argument("--area", default=1.0, help="Solar panel area (m²)")
    parser.add_argument("--eff", default=0.18, help="Panel efficiency (0-1)")

    args = parser.parse_args()
    main(args.lat, args.lon, args.area, args.eff)
