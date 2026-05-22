import os
import sys
import pandas as pd
from prophet import Prophet
from sqlalchemy import create_engine, text
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)


def main():
    try:
        # Get database URL
        db_url = os.getenv("DATABASE_URL")

        if not db_url:
            print("ERROR: DATABASE_URL not found")
            sys.exit(1)

        # Convert Railway/MySQL URL for SQLAlchemy PyMySQL
        if db_url.startswith("mysql://"):
            db_url = db_url.replace(
                "mysql://",
                "mysql+pymysql://",
                1
            )

        # Create SQLAlchemy engine
        engine = create_engine(
            db_url,
            pool_pre_ping=True
        )

        # Fetch historical bookings
        query = """
            SELECT created_at
            FROM bookings
            WHERE created_at IS NOT NULL
            ORDER BY created_at ASC
        """

        df = pd.read_sql(query, engine)

        # Validate minimum data
        if df.empty or len(df) < 5:
            print("WARNING: Not enough booking data for Prophet forecasting.")
            sys.exit(0)

        # Prepare Prophet dataset
        df['created_at'] = pd.to_datetime(df['created_at'])

        daily_bookings = (
            df.groupby(df['created_at'].dt.date)
            .size()
            .reset_index(name='y')
        )

        daily_bookings.columns = ['ds', 'y']

        daily_bookings['ds'] = pd.to_datetime(daily_bookings['ds'])

        # Train Prophet model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )

        model.fit(daily_bookings)

        # Create future dataframe
        future = model.make_future_dataframe(periods=7)

        # Generate forecast
        forecast = model.predict(future)

        # Filter future only
        today = datetime.now().date()

        future_forecast = forecast[
            forecast['ds'].dt.date > today
        ].head(7)

        # Save forecast into DB
        with engine.begin() as connection:

            # Clear old forecasts
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

                predicted = max(
                    0,
                    int(round(row['yhat']))
                )

                conf_min = max(
                    0,
                    int(round(row['yhat_lower']))
                )

                conf_max = max(
                    0,
                    int(round(row['yhat_upper']))
                )

                # AI reasoning text
                if predicted > avg_historical * 1.2:
                    reason = (
                        "AI detected a seasonal peak "
                        "(20% above average demand)."
                    )

                elif predicted < avg_historical * 0.8:
                    reason = (
                        "AI predicts slightly lower "
                        "seasonal demand."
                    )

                else:
                    reason = (
                        "AI predicts stable historical "
                        "demand patterns."
                    )

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
