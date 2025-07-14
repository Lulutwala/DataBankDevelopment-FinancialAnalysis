from pymongo import MongoClient
import requests
from datetime import datetime
from yahoo_fin import stock_info 

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


def fetch_stock_data(symbol):
    api_key = 'CCMZ32I4AIAR1CSW'  
    url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={api_key}'
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data.get("Time Series (Daily)", {})
    except requests.RequestException as e:
        print(f"Error fetching data for {symbol}: {e}")
        return {}


def validate_stock_data(symbol, name, raw_data):
    validated_data = []
    for date, values in raw_data.items():
        try:
            validated_data.append({
                "stock_symbol": symbol,
                "stock_name": name,
                "open_price": float(values.get("1. open", 0.0)),
                "high_price": float(values.get("2. high", 0.0)),
                "low_price": float(values.get("3. low", 0.0)),
                "close_price": float(values.get("4. close", 0.0)),
                "volume": int(values.get("5. volume", 0)),
                "market_cap": 0.0,  
                "timestamp": datetime.strptime(date, '%Y-%m-%d')
            })
        except (ValueError, TypeError):
            print(f"Error processing data for {symbol} on {date}")
    return validated_data


def insert_stock_data(db, stock_data):
    collection = db['stock_data']
    for data in stock_data:
        try:
            collection.update_one(
                {"stock_symbol": data["stock_symbol"], "timestamp": data["timestamp"]}, 
                {"$set": data},  
                upsert=True  
            )
        except Exception as e:
            print(f"Error inserting data for {data['stock_symbol']} on {data['timestamp']}: {e}")
    print(f"Inserted/Updated {len(stock_data)} records in MongoDB.")


def get_stock_symbols():
    try:
        nasdaq_symbols = stock_info.tickers_nasdaq()
        stock_symbols = [{"symbol": symbol, "name": symbol} for symbol in nasdaq_symbols]
        return stock_symbols
    except AttributeError as e:
        print(f"Error fetching stock symbols: {e}")
        return []


def main():
    db = connect_to_db()
    if db is not None:

        stock_symbols = get_stock_symbols()

        if not stock_symbols:
            print("No stock symbols found.")
            return

        for stock in stock_symbols[:100]: 
            raw_data = fetch_stock_data(stock["symbol"])
            if raw_data:
                validated_data = validate_stock_data(stock["symbol"], stock["name"], raw_data)
                insert_stock_data(db, validated_data)


if __name__ == "__main__":
    main()
