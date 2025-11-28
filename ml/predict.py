# # import argparse, joblib, json
# # import pandas as pd
# # from datetime import datetime, timedelta, timezone
# # from ingest_nasa import fetch_nasa_power
# # from features import estimate_production_from_irradiance, add_time_and_rolling

# # def predict(lat, lon, area, eff, model_path='xgb_model_h1.joblib'):
# #     # Convert to absolute path relative to script location
# #     import pathlib
# #     if not pathlib.Path(model_path).is_absolute():
# #         script_dir = pathlib.Path(__file__).parent
# #         model_path = str(script_dir / model_path)
    
# #     # Try to fetch recent data with fallback for API delays
# #     # NASA POWER typically has 7-30 day delay
# #     today = datetime.now(timezone.utc).date()
    
# #     # Try different end dates (going back in time until we get data)
# #     for days_back in [7, 14, 30, 60, 90]:
# #         try:
# #             end = today - timedelta(days=days_back)
# #             start = end - timedelta(days=60)
            
# #             df = fetch_nasa_power(lat, lon, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
            
# #             if not df.empty:
# #                 break  # Successfully got data
# #         except Exception as e:
# #             if days_back == 90:  # Last attempt failed
# #                 print(json.dumps({"error": f"Could not fetch data: {str(e)}"}))
# #                 return
# #             continue  # Try older date
    
# #     df = estimate_production_from_irradiance(df, panel_area_m2=float(area), efficiency=float(eff))
# #     df = add_time_and_rolling(df)
    
# #     # build last row
# #     if df.empty:
# #         print(json.dumps({"error":"no data"}))
# #         return
    
# #     last_row = df.iloc[-1:]
# #     features = ['dayofyear','prod_lag1','prod_ma3','prod_ma7','T2M','CLD','RH2M']
# #     X = last_row[features].fillna(0).values
    
# #     try:
# #         model = joblib.load(model_path)
# #     except Exception as e:
# #         print(json.dumps({"error": f"model load error: {str(e)}"}))
# #         return
    
# #     pred = float(model.predict(X)[0])
    
# #     # baseline: use prod_ma7 of last_row as naive baseline
# #     baseline = float(last_row['prod_ma7'].values[0]) if 'prod_ma7' in last_row else pred
    
# #     # Calculate next day's date
# #     last_date = last_row['date'].values[0]
# #     if isinstance(last_date, pd.Timestamp):
# #         next_date = (last_date + pd.Timedelta(days=1)).strftime('%Y-%m-%d')
# #     else:
# #         next_date = (pd.Timestamp(last_date) + pd.Timedelta(days=1)).strftime('%Y-%m-%d')
    
# #     output = {
# #         "predictions": [
# #             {
# #                 "date": next_date,
# #                 "pred_kwh": pred
# #             }
# #         ],
# #         "baseline": baseline
# #     }
    
# #     print(json.dumps(output))

# # if __name__ == "__main__":
# #     parser = argparse.ArgumentParser()
# #     parser.add_argument('--lat', required=True)
# #     parser.add_argument('--lon', required=True)
# #     parser.add_argument('--area', default=1.0)
# #     parser.add_argument('--eff', default=0.18)
# #     parser.add_argument('--model', default='xgb_model_h1.joblib')
# #     args = parser.parse_args()
# #     predict(args.lat, args.lon, args.area, args.eff, args.model)

# import argparse, joblib, json
# import pandas as pd
# import numpy as np
# from datetime import datetime, timedelta, timezone
# from ingest_nasa import fetch_nasa_power
# from features import estimate_production_from_irradiance, add_time_and_rolling

# def predict(lat, lon, area, eff, model_path='xgb_model_h1.joblib', days_ahead=7):
#     # Convert to absolute path relative to script location
#     import pathlib
#     if not pathlib.Path(model_path).is_absolute():
#         script_dir = pathlib.Path(__file__).parent
#         model_path = str(script_dir / model_path)
    
#     # Try to fetch recent data with fallback for API delays
#     today = datetime.now(timezone.utc).date()
    
#     # Try different end dates (going back in time until we get data)
#     for days_back in [7, 14, 30, 60, 90]:
#         try:
#             end = today - timedelta(days=days_back)
#             start = end - timedelta(days=60)
            
#             df = fetch_nasa_power(lat, lon, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
            
#             if not df.empty:
#                 break  # Successfully got data
#         except Exception as e:
#             if days_back == 90:  # Last attempt failed
#                 print(json.dumps({"error": f"Could not fetch data: {str(e)}"}))
#                 return
#             continue  # Try older date
    
#     df = estimate_production_from_irradiance(df, panel_area_m2=float(area), efficiency=float(eff))
#     df = add_time_and_rolling(df)
    
#     if df.empty:
#         print(json.dumps({"error":"no data"}))
#         return
    
#     # Load model
#     try:
#         model = joblib.load(model_path)
#     except Exception as e:
#         print(json.dumps({"error": f"model load error: {str(e)}"}))
#         return
    
#     # baseline: use prod_ma7 of last_row as naive baseline
#     last_row = df.iloc[-1:]
#     baseline = float(last_row['prod_ma7'].values[0]) if 'prod_ma7' in last_row else 0.0
    
#     # Features used by the model
#     features = ['dayofyear','prod_lag1','prod_ma3','prod_ma7','T2M','CLD','RH2M']
    
#     # Generate 7-day forecast
#     predictions = []
    
#     # Start from the last known date
#     last_date = last_row['date'].values[0]
#     if isinstance(last_date, pd.Timestamp):
#         current_date = last_date
#     else:
#         current_date = pd.Timestamp(last_date)
    
#     # Keep track of recent predictions for rolling features
#     recent_preds = list(df['prod_kwh'].tail(7).values) if 'prod_kwh' in df else []
    
#     for day in range(1, days_ahead + 1):
#         # Calculate next date
#         next_date = current_date + pd.Timedelta(days=day)
        
#         # Build features for next day
#         dayofyear = next_date.dayofyear
        
#         # Use last known or predicted values for lagged features
#         if len(recent_preds) >= 1:
#             prod_lag1 = recent_preds[-1]
#         else:
#             prod_lag1 = baseline
        
#         if len(recent_preds) >= 3:
#             prod_ma3 = np.mean(recent_preds[-3:])
#         else:
#             prod_ma3 = baseline
        
#         if len(recent_preds) >= 7:
#             prod_ma7 = np.mean(recent_preds[-7:])
#         else:
#             prod_ma7 = baseline
        
#         # For weather features, use last known values (simple approach)
#         # In production, you'd fetch weather forecast data here
#         T2M = float(last_row['T2M'].values[0]) if 'T2M' in last_row else 20.0
#         CLD = float(last_row['CLD'].values[0]) if 'CLD' in last_row else 50.0
#         RH2M = float(last_row['RH2M'].values[0]) if 'RH2M' in last_row else 60.0
        
#         # Create feature array
#         X = np.array([[dayofyear, prod_lag1, prod_ma3, prod_ma7, T2M, CLD, RH2M]])
        
#         # Make prediction
#         pred = float(model.predict(X)[0])
        
#         # Store prediction
#         predictions.append({
#             "date": next_date.strftime('%Y-%m-%d'),
#             "pred_kwh": pred
#         })
        
#         # Update recent predictions for next iteration
#         recent_preds.append(pred)
#         if len(recent_preds) > 7:
#             recent_preds.pop(0)
    
#     output = {
#         "predictions": predictions,
#         "baseline": baseline
#     }
    
#     print(json.dumps(output))

# if __name__ == "__main__":
#     parser = argparse.ArgumentParser()
#     parser.add_argument('--lat', required=True)
#     parser.add_argument('--lon', required=True)
#     parser.add_argument('--area', default=1.0)
#     parser.add_argument('--eff', default=0.18)
#     parser.add_argument('--model', default='xgb_model_h1.joblib')
#     parser.add_argument('--days', type=int, default=7, help='Number of days to forecast')
#     args = parser.parse_args()
#     predict(args.lat, args.lon, args.area, args.eff, args.model, args.days)

#!/usr/bin/env python3
import argparse, joblib, json, sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from collections import deque
from ingest_nasa import fetch_nasa_power
from features import estimate_production_from_irradiance, add_time_and_rolling
import pathlib

def fail_json(msg):
    out = {"error": str(msg)}
    # write to stdout so caller that expects JSON can parse it; exit non-zero
    sys.stdout.write(json.dumps(out))
    sys.stdout.flush()
    sys.exit(1)

def predict(lat, lon, area, eff, model_path='xgb_model_h1.joblib', days_ahead=7):
    try:
        # normalize model path
        if not pathlib.Path(model_path).is_absolute():
            script_dir = pathlib.Path(__file__).parent
            model_path = str(script_dir / model_path)

        # Use UTC date
        today = datetime.now(timezone.utc).date()

        # fetch with fallbacks
        df = None
        last_exc = None
        for days_back in [7, 14, 30, 60, 90]:
            try:
                end = today - timedelta(days=days_back)
                start = end - timedelta(days=60)
                df = fetch_nasa_power(lat, lon, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
                if df is not None and not df.empty:
                    break
            except Exception as e:
                last_exc = e
                continue
        if df is None or df.empty:
            fail_json("no data or fetch failed: " + (str(last_exc) if last_exc else "empty"))

        # feature pipeline
        df = estimate_production_from_irradiance(df, panel_area_m2=float(area), efficiency=float(eff))
        df = add_time_and_rolling(df)
        if df is None or df.empty:
            fail_json("no data after feature processing")

        # load model
        try:
            model = joblib.load(model_path)
        except Exception as e:
            fail_json("model load error: " + str(e))

        # prepare sliding window
        last_row = df.iloc[-1:]
        baseline = float(last_row['prod_ma7'].values[0]) if 'prod_ma7' in last_row and not np.isnan(last_row['prod_ma7'].values[0]) else 0.0
        recent_vals = list(df['prod_kwh'].dropna().tail(7).values) if 'prod_kwh' in df else []
        dq = deque(maxlen=7)
        for v in recent_vals:
            dq.append(float(v))
        if len(dq) == 0:
            dq.append(baseline)

        # forecast starting from today (UTC) or last_known whichever is later
        last_known_date = pd.Timestamp(last_row['date'].values[0])
        today_ts = pd.Timestamp(today)
        start_date = max(last_known_date, today_ts)

        predictions = []
        current_date = start_date
        for i in range(days_ahead):
            next_date = (current_date + pd.Timedelta(days=i)).normalize()
            dayofyear = int(next_date.dayofyear)

            prod_lag1 = float(dq[-1]) if len(dq) >= 1 else baseline
            prod_ma3 = float(np.mean(list(dq)[-3:])) if len(dq) >= 1 else baseline
            prod_ma7 = float(np.mean(list(dq))) if len(dq) >= 1 else baseline

            T2M = float(last_row['T2M'].values[0]) if 'T2M' in last_row and not np.isnan(last_row['T2M'].values[0]) else 20.0
            CLD = float(last_row['CLD'].values[0]) if 'CLD' in last_row and not np.isnan(last_row['CLD'].values[0]) else 50.0
            RH2M = float(last_row['RH2M'].values[0]) if 'RH2M' in last_row and not np.isnan(last_row['RH2M'].values[0]) else 60.0

            X = np.array([[dayofyear, prod_lag1, prod_ma3, prod_ma7, T2M, CLD, RH2M]])
            pred = model.predict(X)[0]
            # convert numpy types to native
            pred_val = float(pred)

            predictions.append({
                "date": next_date.strftime('%Y-%m-%d'),
                "pred_kwh": pred_val
            })

            dq.append(pred_val)

        out = {
            "predictions": predictions,
            "baseline": float(baseline),
            "start_date": start_date.strftime('%Y-%m-%d'),
            "last_known_date": last_known_date.strftime('%Y-%m-%d')
        }
        # single JSON output, nothing else printed
        sys.stdout.write(json.dumps(out))
        sys.stdout.flush()
        return

    except Exception as e:
        # Any unexpected exception — return JSON describing it (no stacktrace on stdout)
        fail_json("unexpected error: " + str(e))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--lat', required=True)
    parser.add_argument('--lon', required=True)
    parser.add_argument('--area', default=1.0)
    parser.add_argument('--eff', default=0.18)
    parser.add_argument('--model', default='xgb_model_h1.joblib')
    parser.add_argument('--days', type=int, default=7)
    args = parser.parse_args()
    predict(args.lat, args.lon, args.area, args.eff, args.model, args.days)
