import asyncio
from fastapi import FastAPI
from redis import Redis

from utils.config import SCRAPER_CONFIG, SERVER_CONFIG, REDIS_CONFIG
from models.browserController import PlaywrightBrowserController

app = FastAPI()
controller = PlaywrightBrowserController()
redis = Redis(host=REDIS_CONFIG["host"], port=REDIS_CONFIG["port"], decode_responses=True)

CACHE_TTL = SCRAPER_CONFIG["cache_ttl"]

@app.on_event("startup")
async def startup():
    await controller.start()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "scraper": "running" if controller.is_running() else "stopped",
        "cache": "connected" if redis.ping() else "disconnected"
        }

@app.get("/scrape/get_data")
async def get_data():
    cached_data = redis.get("scraped_data")
    if cached_data:
        print(f"[INFO] Scrapping data -> {cached_data}")
        return {"data": cached_data, "source": "cache"}
    return {"data": None, "source": "api"}

@app.on_event("shutdown")
async def shutdown():
    await controller.close()
    redis.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=SERVER_CONFIG["host"], port=SERVER_CONFIG["port"])