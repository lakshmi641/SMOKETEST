import os
import sys
import subprocess
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def run_diagnostics():
    print("--- 🔍 System Diagnostics ---")
    
    # 0. Check Docker Daemon
    try:
        subprocess.run(["docker", "version"], check=True, capture_output=True, text=True)
        print("✅ Docker Daemon is running.")
    except Exception:
        print("❌ Docker Daemon is NOT reachable.")
        print("   Tip: Start Docker Desktop and run PowerShell as Administrator.")

    # 1. Check if 'src' is in path
    try:
        sys.path.append(os.getcwd())
        import src
        print("✅ 'src' package is importable.")
    except ImportError:
        print("❌ 'src' package not found. Current directory:", os.getcwd())
        print("   Tip: Ensure you are running this script from the agent root directory.")

    # 2. Load environment variables
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return

    # 3. Check for Database Driver
    try:
        import psycopg2
        print("✅ Database driver 'psycopg2' is installed.")
    except ImportError:
        print("❌ Database driver 'psycopg2' not found. Run: pip install psycopg2-binary")
        return

    # 4. Handle Docker vs Local Hostname
    # Swaps 'postgres' with 'localhost' if it's the hostname in the connection string
    test_url = db_url.replace("@postgres", "@localhost")
    if test_url != db_url:
        print("ℹ️  Detected Docker hostname 'postgres'. Swapping to 'localhost' for local access.")

    print(f"--- 🗄️  Database Connection Test ---")
    print(f"Target URL: {test_url}")

    try:
        engine = create_engine(test_url, connect_args={'connect_timeout': 5})
        
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            if result.fetchone()[0] == 1:
                print("✅ Database connection successful!")
                
    except Exception as e:
        print(f"❌ Database connection failed: {type(e).__name__}")
        print(f"Details: {e}")
        print("\n--- 🛠️  Troubleshooting Tips ---")
        print("1. CRITICAL: Is Docker Desktop running? Check your system tray for the whale icon.")
        print("2. PERMISSIONS: Try running your terminal (PowerShell) as Administrator.")
        print("3. Is the container running? Run: docker ps")
        print("4. If not running, go to infra/docker and run: docker compose up -d postgres")
        print("5. Is the port 5432 mapped in your docker-compose.yml?")

if __name__ == "__main__":
    run_diagnostics()