from pymongo import MongoClient
import requests
from datetime import datetime, timezone
import time

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

# Fetching all crypto data from CoinGecko
def fetch_all_crypto_data():
    base_url = "https://api.coingecko.com/api/v3/coins/markets"
    all_crypto_data = []
    page = 1

    while True:
        try:
            response = requests.get(base_url, params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": 250,
                "page": page
            })
            response.raise_for_status()
            data = response.json()

            if len(data) == 0:  # Stop if no more data is fetched
                break

            for coin in data:
                all_crypto_data.append({
                    "coin_name": coin["name"],
                    "market_price": coin["current_price"],
                    "price_change_1h": coin.get("price_change_percentage_1h_in_currency", 0.0),
                    "price_change_24h": coin.get("price_change_percentage_24h_in_currency", 0.0),
                    "price_change_7d": coin.get("price_change_percentage_7d_in_currency", 0.0),
                    "price_change_30d": coin.get("price_change_percentage_30d_in_currency", 0.0),
                    "volume_24h": coin["total_volume"],
                    "circulating_supply": coin["circulating_supply"],
                    "total_supply": coin.get("total_supply", 0.0),
                    "market_cap": coin["market_cap"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            print(f"Fetched page {page} with {len(data)} coins.")
            page += 1
            
            time.sleep(1)

        except requests.RequestException as e:
            print(f"Error fetching data from CoinGecko: {e}")
            break

    return all_crypto_data

# Inserting crypto data into MongoDB
def insert_crypto_data(db, crypto_data):
    collection = db['crypto_data']
    try:
        collection.insert_many(crypto_data)
        print(f"{len(crypto_data)} records inserted.")
    except Exception as e:
        print(f"Error inserting data into MongoDB: {e}")

# Main function
def main():
    db = connect_to_db()
    if db is not None:
        print("Fetching crypto data...")
        crypto_data = fetch_all_crypto_data()
        if crypto_data:
            insert_crypto_data(db, crypto_data)
        else:
            print("No crypto data fetched")
    else:
        print("Failed to connect to the database.")

if __name__ == "__main__":
    main()
