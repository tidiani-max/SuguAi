import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def fix():
    try:
        async with SessionLocal() as db:
            biz_id = 'aaa384bf-825c-43ab-b108-09c95ee46314'
            print(f"Targeting Business: {biz_id}")
            
            # Delete in order to respect Foreign Keys
            await db.execute(text("DELETE FROM messages WHERE business_id = :id"), {"id": biz_id})
            await db.execute(text("DELETE FROM customers WHERE business_id = :id"), {"id": biz_id})
            
            await db.commit()
            print("Successfully cleaned v1 data. Ready for v2.3.7!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix())
