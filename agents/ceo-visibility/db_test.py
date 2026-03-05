import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def test_connection():
    # Load environment variables from .env
    load_dotenv()
    
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("Error: DATABASE_URL not found in .env file.")
        return

    # Automatically swap 'postgres' to 'localhost' if running outside Docker
    test_url = db_url
    if "@postgres:" in db_url:
        print("ℹ️  Detected Docker hostname 'postgres'. Using 'localhost' for this local test.")
        test_url = db_url.replace("@postgres:", "@localhost:")

    print(f"Attempting to connect to: {test_url}")

    try:
        engine = create_engine(test_url)
        
        # Try to connect and execute a simple query
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            if result.fetchone()[0] == 1:
                print("\n✅ Database connection successful!")
                
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        print("\nTroubleshooting Tips:")
        print("1. Ensure your Docker containers are running (docker-compose up -d).")
        print("2. If you are running this script directly on Windows (not inside Docker):")
        print("   Change 'postgres' to 'localhost' in your .env file DATABASE_URL.")

if __name__ == "__main__":
    test_connection()