# Solar Throughput Forecasting using NASA POWER Data

This project provides an end-to-end solar forecasting system using NASA POWER datasets. It processes historical meteorological features, applies machine learning models to estimate solar energy throughput, and exposes a lightweight interface for predictions.

## Features

- Automated data ingestion from NASA POWER API
- Preprocessing, cleaning, and feature engineering for solar radiation datasets
- Multiple machine learning models for prediction (XGBoost, Random Forest, Linear Regression, etc.)
- Evaluation of model performance with metrics and comparative analysis
- End-to-end forecasting pipeline integrated into a full-stack application
- Optional real-time prediction interface using Streamlit or API endpoints

## Data Source

The project uses the **NASA POWER** (Prediction Of Worldwide Energy Resources) API, which provides global meteorological and solar parameters at daily resolution. Relevant variables include:

- Solar irradiance components
- Temperature
- Humidity
- Wind speed
- Cloud coverage

## Project Structure

```
project-root/
│
├── ml/
│   ├── ingest_nasa.py        # Data ingestion scripts
│   ├── preprocess.py         # Cleaning and feature engineering
│   ├── train_models.py       # Model training and evaluation
│   ├── predict.py            # Prediction logic
│   ├── models/               # Saved model artifacts
│   └── datasets/             # Raw and processed data
│
├── frontend/                 # Optional dashboard or UI
├── backend/                  # Optional API layer
├── requirements.txt
└── README.md
```

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # On Windows
   # source venv/bin/activate  # On macOS/Linux
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Run the NASA Data Ingestion
```bash
python ml/ingest_nasa.py
```

### Preprocess Data
```bash
python ml/preprocess.py
```

### Train Models
```bash
python ml/train_models.py
```

### Generate Predictions
```bash
python ml/predict.py
```

### If using the UI (Streamlit):
```bash
streamlit run app.py
```

## Model Overview

The system supports and compares multiple ML algorithms:

- **Gradient Boosted Trees** (XGBoost)
- **Random Forest Regressor**
- **Linear Regression**
- **Ensemble and hybrid approaches**

The final model is selected based on key performance metrics such as **RMSE**, **MAE**, and **R²**.

## Key Outcomes

- Predicts solar throughput for selected coordinates
- Enables planning for solar installations and energy forecasting
- Provides reproducible and automated data workflows
- Designed for deployment in web-based or API-driven environments

## Future Enhancements

- Integration of deep learning models
- Forecasting for multiple spatial points simultaneously
- Long-term prediction capabilities
- Deployment via Docker or cloud services

## License

This project is released under the **MIT License**.

---

**Contributing:** Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

**Contact:** For questions or feedback, please open an issue on GitHub.
