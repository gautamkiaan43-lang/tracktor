import os
import sys
import pandas as pd
from prophet import Prophet
import mysql.connector
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load env variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

def main():
    try:
        # Parse DATABASE_URL manually or just connect directly based on the known format
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            print("ERROR: DATABASE_URL not found")
            sys.exit(1)
            
        # Example format: mysql://root:@127.0.0.1:3306/tractor
        # Simple parser for this specific format
        parts = db_url.replace("mysql://", "").split("/")
        auth_host = parts[0]
        db_name = parts[1].split("?")[0]
        
        auth, host_port = auth_host.split("@")
        user = auth.split(":")[0]
        password = auth.split(":")[1] if ":" in auth else ""
        host, port = host_port.split(":")

        conn = mysql.connector.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=db_name
        )
        
        # 1. Fetch Historical Bookings
        query = "SELECT created_at FROM bookings"
        df = pd.read_sql(query, conn)
        
        if df.empty or len(df) < 5:
            print("WARNING: Not enough data for Prophet. Minimum 5 bookings required.")
            sys.exit(0)

        # 2. Format Data for Prophet
        # Prophet requires columns 'ds' (date) and 'y' (value)
        df['ds'] = pd.to_datetime(df['created_at']).dt.date
        daily_bookings = df.groupby('ds').size().reset_index(name='y')
        
        # 3. Train Prophet Model
        m = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=False)
        m.fit(daily_bookings)
        
        # 4. Predict Next 7 Days
        future = m.make_future_dataframe(periods=7)
        forecast = m.predict(future)
        
        # Filter only the future 7 days
        today = datetime.now().date()
        future_forecast = forecast[forecast['ds'].dt.date > today].head(7)
        
        cursor = conn.cursor()
        
        # Clear existing forecast
        cursor.execute("DELETE FROM ai_forecast_reports")
        
        # 5. Insert new accurate predictions
        insert_query = """
            INSERT INTO ai_forecast_reports 
            (forecast_date, predicted_bookings, confidence_min, confidence_max, reason, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
        """
        
        for index, row in future_forecast.iterrows():
            f_date = row['ds']
            # Prophet sometimes outputs negative predictions if data drops; floor at 0
            predicted = max(0, int(round(row['yhat'])))
            conf_min = max(0, int(round(row['yhat_lower'])))
            conf_max = max(0, int(round(row['yhat_upper'])))
            
            # Simple logic for peak vs normal
            avg_historical = daily_bookings['y'].mean()
            if predicted > avg_historical * 1.2:
                reason = "AI detected a seasonal peak (demand 20%+ above average)."
            elif predicted < avg_historical * 0.8:
                reason = "AI expects a slight dip in demand based on seasonal trends."
            else:
                reason = "AI predicts steady, average demand matching historical patterns."
                
            cursor.execute(insert_query, (f_date, predicted, conf_min, conf_max, reason))
            
        conn.commit()
        cursor.close()
        conn.close()
        
        print("SUCCESS: Prophet forecast generated and saved to DB.")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
