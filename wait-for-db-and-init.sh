#!/bin/bash
set -e

# Wait for PostgreSQL to be ready using Python connection test
echo "Waiting for PostgreSQL to be ready..."
python3 -c "
import time
import psycopg2
import os
host = os.getenv('DB_HOST', 'postgres')
port = int(os.getenv('DB_PORT', 5432))
user = os.getenv('DB_USER', 'bluesky')
password = os.getenv('DB_PASSWORD', 'changeme')
dbname = os.getenv('DB_NAME', 'bluesky')
max_attempts = 60
attempt = 0
while attempt < max_attempts:
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
        conn.close()
        print('PostgreSQL connection successful')
        break
    except Exception as e:
        print(f'PostgreSQL not ready yet ({attempt+1}/{max_attempts}): {e}')
        time.sleep(2)
        attempt += 1
else:
    print('Failed to connect to PostgreSQL after maximum attempts')
    exit(1)
"

# Initialize database
echo "Initializing database tables and admin user..."
python3 /app/init-db-test.py

echo "Starting application..."
exec /app/start.sh
