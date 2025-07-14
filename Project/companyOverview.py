import pandas as pd
from pymongo import MongoClient
import time
from yahoo_fin import stock_info as si
import yfinance as yf


uri = 'mongodb://localhost:27017/Financial_analysis'

def connect_to_db():
    try:
        client = MongoClient(uri)
        db = client['Financial_analysis']
        print("Connected to the database")
        return db
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

def fetch_company_data(symbol):
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        
        return {
            "symbol": symbol,
            "name": info.get("longName", ""),
            "industry": info.get("industry", ""),
            "sector": info.get("sector", ""),
            "market_capitalization": info.get("marketCap", ""),
            "EBITDA": info.get("ebitda", ""),
            "PE_ratio": info.get("trailingPE", ""),
            "PEG_ratio": info.get("pegRatio", ""),
            "book_value": info.get("bookValue", ""),
            "dividend_per_share": info.get("dividendRate", ""),
            "dividend_yield": info.get("dividendYield", ""),
            "EPS": info.get("trailingEps", ""),
            "revenue_ttm": info.get("totalRevenue", ""),
            "profit_margin": info.get("profitMargins", ""),
            "operating_margin_ttm": info.get("operatingMargins", ""),
            "return_on_assets_ttm": info.get("returnOnAssets", ""),
            "return_on_equity_ttm": info.get("returnOnEquity", ""),
            "gross_profit_ttm": info.get("grossProfits", ""),
            "beta": info.get("beta", ""),
            "52_week_high": info.get("fiftyTwoWeekHigh", ""),
            "52_week_low": info.get("fiftyTwoWeekLow", ""),
            "50_day_moving_average": info.get("fiftyDayAverage", ""),
            "200_day_moving_average": info.get("twoHundredDayAverage", ""),
            "shares_outstanding": info.get("sharesOutstanding", ""),
            "dividend_date": info.get("exDividendDate", ""),
            "exchange": info.get("exchange", ""),
            "currency": info.get("currency", "")
        }
    except Exception as e:
        print(f"Error fetching data for {symbol}: {e}")
        return None

def insert_into_db(db, data):
    if db is not None and data is not None:
        collection = db['company_overview']
        try:
            existing_data = collection.find_one({"symbol": data["symbol"]})
            if existing_data:
                print(f"Data for {data['symbol']} already exists.")
            else:
                collection.insert_one(data)
                print(f"Data inserted for {data['symbol']}")
        except Exception as e:
            print(f"Error inserting data into MongoDB: {e}")

def main():
    db = connect_to_db()
    
    # Read the CSV file
    df = pd.read_csv('stock_info.csv')  # Rep
    print(df.head())  
    symbols = df['Ticker'].tolist()
    print("Symbols to fetch data for:", symbols)
    
    for symbol in symbols:
        print(f"Fetching data for: {symbol}")
        data = fetch_company_data(symbol)
        if data:
            insert_into_db(db, data)
        time.sleep(2)  

if __name__ == "__main__":
    main()
