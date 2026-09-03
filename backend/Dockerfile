FROM python:3.11-slim

WORKDIR /app

# psycopg[binary] hanya dibutuhkan di container (dev lokal memakai SQLite).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "psycopg[binary]>=3.2"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
