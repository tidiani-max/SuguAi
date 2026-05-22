import asyncio
import os
import sys
from sqlalchemy import text

# Add current directory to path so it can find 'app'
sys.path.append(os.getcwd())

from app.db.session import SessionLocal

async def run_cleanup():
    sql = """
    DELETE FROM customers a USING customers b
    WHERE a.business_id = b.business_id
      AND a.id < b.id
      AND (
        a.whatsapp_phone = split_part(b.whatsapp_phone, '@', 1)
        OR b.whatsapp_phone = split_part(a.whatsapp_phone, '@', 1)
      );
    """
    try:
        async with SessionLocal() as db:
            print("Connecting to database...")
            result = await db.execute(text(sql))
            await db.commit()
            print(f"Success! Cleaned up duplicate customers.")
    except Exception as e:
        print(f"Error running cleanup: {e}")

if __name__ == "__main__":
    asyncio.run(run_cleanup())
