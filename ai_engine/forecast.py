import os
import sys
import pandas as pd
from prophet import Prophet
from sqlalchemy import create_engine, text
from datetime import datetime
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

def main():
    try:
        db_url = os.getenv('DATABASE_URL')

        if not db_url:
            print("ERROR: DATABASE_URL not found")
            sys.exit(1)

        engine = create_engine(db_url)

        query = "SELECT created_at FROM bookings"

        df = pd.read_sql(query, engine)

        if df.empty or len(df) < 5:
            print("WARNING: Not enough data for Prophet. Minimum 5 bookings required.")
            sys.exit(0)

        df['ds'] = pd.to_datetime(df['created_at'])

        daily_bookings = df.groupby(df['ds'].dt.date).size().reset_index(name='y')

        daily_bookings['ds'] = pd.to_datetime(daily_bookings['ds'])

        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False
        )

        model.fit(daily_bookings)

        future = model.make_future_dataframe(periods=7)

        forecast = model.predict(future)

        today = datetime.now().date()

        future_forecast = forecast[
            forecast['ds'].dt.date > today
        ].head(7)

        with engine.begin() as connection:

            connection.execute(
                text("DELETE FROM ai_forecast_reports")
            )

            insert_query = text("""
                INSERT INTO ai_forecast_reports
                (
                    forecast_date,
                    predicted_bookings,
                    confidence_min,
                    confidence_max,
                    reason,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    :forecast_date,
                    :predicted_bookings,
                    :confidence_min,
                    :confidence_max,
                    :reason,
                    NOW(),
                    NOW()
                )
            """)

            avg_historical = daily_bookings['y'].mean()

            for _, row in future_forecast.iterrows():

                predicted = max(0, int(round(row['yhat'])))
                conf_min = max(0, int(round(row['yhat_lower'])))
                conf_max = max(0, int(round(row['yhat_upper'])))

                if predicted > avg_historical * 1.2:
                    reason = "AI detected a seasonal peak (20% above average demand)."
                elif predicted < avg_historical * 0.8:
                    reason = "AI predicts slightly lower seasonal demand."
                else:
                    reason = "AI predicts stable historical demand patterns."

                connection.execute(
                    insert_query,
                    {
                        "forecast_date": row['ds'].to_pydatetime(),
                        "predicted_bookings": predicted,
                        "confidence_min": conf_min,
                        "confidence_max": conf_max,
                        "reason": reason
                    }
                )

        print("SUCCESS: Prophet forecast generated and saved to DB.")

    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
