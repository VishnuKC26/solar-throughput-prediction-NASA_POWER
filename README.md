# Solar Throughput Forecasting using NASA POWER Data

This project provides an end-to-end solar forecasting system using NASA POWER datasets. It processes historical meteorological features, applies machine learning models to estimate solar energy throughput, and exposes a lightweight interface for predictions.

## Overview

The ML pipeline consists of 6 tightly interconnected stages, each implemented in a dedicated Python file:

1. **Data Ingestion** - `ml/ingest_nasa.py`
2. **Physical Energy Conversion** - `ml/features.py`
3. **Time-Series Feature Engineering** - `ml/features.py`
4. **Model Training + Validation** - `ml/train_xgb.py`
5. **Prediction Engine** - `ml/predict.py`
6. **Runtime Executor for Dashboard** - `ml_runner.py`

## Features

- Automated data ingestion from NASA POWER API
- Physical conversion of irradiance to energy output
- Time-series feature engineering with lag and rolling features
- Ensemble machine learning models (XGBoost, LightGBM, Random Forest)
- Climatology baseline comparison for deviation detection
- Evaluation with multiple performance metrics (MAE, RMSE, R², SMAPE, NMAE)
- Subprocess-based runtime executor for safe dashboard integration
- JSON-based prediction output format

## Data Source

The project uses the **NASA POWER** (Prediction Of Worldwide Energy Resources) API, which provides global meteorological and solar parameters at daily resolution:

- **Global Horizontal Irradiance (GHI)** - `ALLSKY_SFC_SW_DWN`
- **Temperature** - `T2M`
- **Relative Humidity** - `RH2M`
- **Cloud Coverage** - `CLD` (computed)

API Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`

**Note:** NASA POWER data has a 30-45 day latency, so the system requests older windows (45-150 days ago).

## Project Structure

```
project-root/
│
├── ml/
│   ├── ingest_nasa.py        # Data ingestion from NASA POWER API
│   ├── features.py           # Physical conversion and feature engineering
│   ├── train_xgb.py          # Model training and validation
│   ├── predict.py            # Prediction engine
│   ├── models/               # Saved model artifacts (.joblib)
│   └── datasets/             # Raw and processed data
│
├── ml_runner.py              # Runtime executor for dashboard
├── requirements.txt
└── README.md
```

## Installation

### Requirements

- Python 3.9+
- pandas
- numpy
- xgboost
- lightgbm
- scikit-learn
- requests
- joblib
- reportlab (optional)

### Install Dependencies

```bash
pip install -r requirements.txt
```

## Usage

### Train a Model

```bash
python ml/train_xgb.py --lat 28.6139 --lon 77.2090 --area 1 --eff 0.18
```

### Run a Prediction

```bash
python ml_runner.py --lat 28.6139 --lon 77.2090 --area 1 --eff 0.18
```

### Generate Predictions (Direct)

```bash
python ml/predict.py
```

## Pipeline Stages

### 1. Data Ingestion (`ml/ingest_nasa.py`)

Fetches daily solar and weather data from NASA POWER API.

**Key Function:** `fetch_nasa_power(lat, lon, start, end)`

**Processing:**
- Handles NASA's missing values (-999 → NaN)
- Adds dummy cloud cover column for model compatibility
- Returns daily dataframe with date, irradiance, temperature, humidity, and cloud cover

### 2. Physical Energy Conversion (`ml/features.py`)

Converts NASA's irradiance (kWh/m²/day) into solar panel energy output (kWh/day).

**Formula:**
```
energy = GHI × panel_area_m² × efficiency × performance_ratio
```

**Defaults:**
- Area = 1.0 m²
- Efficiency = 18%
- Performance Ratio = 0.75 (loss correction)

**Key Function:** `estimate_production_from_irradiance(df)`

### 3. Time-Series Feature Engineering (`ml/features.py`)

Creates temporal features for seasonal patterns and trends.

**Features Added:**

| Feature | Meaning |
|---------|---------|
| dayofyear | Seasonal signal (1-365) |
| prod_lag1 | Yesterday's production |
| prod_ma3 | 3-day moving average |
| prod_ma7 | 7-day moving average |

**Key Function:** `add_time_and_rolling(df)`

### 4. Model Training & Validation (`ml/train_xgb.py`)

Trains an ensemble model and evaluates against a climatology baseline.

**Models Used:**
- XGBoost Regressor
- LightGBM Regressor
- Random Forest Regressor
- Combined using VotingRegressor

**Validation Method:**
- Chronological split (80% train, 20% test)
- Metrics: MAE, RMSE, R², SMAPE, NMAE

**Baseline:**
Train-period mean energy output (average daily prediction)

**Output Files:**
- `ensemble_model.joblib`
- `validation_report.json`

### 5. Prediction Engine (`ml/predict.py`)

Generates future solar production forecasts for N days.

**Steps:**
1. Fetch NASA POWER data (older window)
2. Convert irradiance to energy
3. Build rolling features
4. Compute climatology baseline (same day-of-year average)
5. Predict next N days
6. Calculate deviation from baseline

**Output Example (JSON):**
```json
{
  "predictions": [
    {
      "date": "2025-12-01",
      "pred_kwh": 0.45,
      "baseline_kwh": 0.38,
      "deviation_kwh": 0.07
    }
  ],
  "baseline": 0.38
}
```

### 6. Runtime Executor (`ml_runner.py`)

Provides a safe interface for the dashboard to call the ML pipeline.

**Responsibilities:**
- Executes `predict.py` in a subprocess
- Captures stdout (valid JSON)
- Captures stderr for debugging
- Passes final JSON to frontend

## End-to-End Flow

```
Dashboard → ml_runner.py
              ↓
          predict.py
              ↓
      ingest_nasa.py  → NASA POWER API
              ↓
           features.py
              ↓
         Model Loaded (.joblib)
              ↓
        Predictions JSON
              ↓
          Dashboard UI
```

## Deviation Alerts Logic

### Baseline
Computed using climatology (same day-of-year average over historical data).

### Deviation
```
deviation = pred_kwh - baseline_kwh
```

### Interpretation
- **Negative deviation** → underperformance → alert triggered
- **Positive deviation** → overperformance → normal operation

## Model Performance Metrics

- **MAE** (Mean Absolute Error) - Average prediction error
- **RMSE** (Root Mean Square Error) - Penalizes large errors
- **R²** (Coefficient of Determination) - Variance explained
- **SMAPE** (Symmetric Mean Absolute Percentage Error) - Relative error
- **NMAE** (Normalized Mean Absolute Error) - Scaled error metric

## Future Enhancements

- Multi-year climatology baseline (5+ years of historical data)
- Weather forecast API integration for future T2M, RH2M, CLD
- Confidence intervals for predictions
- Monthly automatic model retraining
- Support for different panel types and installation angles
- Deep learning models (LSTM, Transformers)
- Multi-location simultaneous forecasting
- Docker containerization for deployment
- Cloud deployment (AWS, Azure, GCP)

## Key Outcomes

- Predicts solar throughput for selected coordinates with high accuracy
- Enables planning for solar installations and energy forecasting
- Provides reproducible and automated data workflows
- Designed for deployment in web-based or API-driven environments
- Combines physical modeling with modern machine learning techniques
- Production-ready architecture supporting research and real-world deployment

## License

This project is released under the **MIT License**.

---

**Contributing:** Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

**Contact:** For questions or feedback, please open an issue on GitHub.
