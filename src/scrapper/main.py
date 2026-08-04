import asyncio
import json
from fastapi import FastAPI
from redis import Redis

from utils.config import SCRAPER_CONFIG, SERVER_CONFIG, REDIS_CONFIG
from models.browserController import PlaywrightBrowserController
from strategies.multiplexScrapping import MultiplexStrategy

app = FastAPI()
controller = PlaywrightBrowserController()
redis = Redis(host=REDIS_CONFIG["host"], port=REDIS_CONFIG["port"], decode_responses=True)

CACHE_TTL = SCRAPER_CONFIG["cache_ttl"]

async def startup():
    await controller.start()
    await controller.run()

async def run_initial_scrape():
    try:
        strategies = [MultiplexStrategy()]
        tasks = [controller.scrapper_page(s) for s in strategies]
        movies_lists = await asyncio.gather(*tasks)

        #redis.setex("scraped_data", CACHE_TTL, json.dumps(all_movies))
        print(f"[INFO] Scraping inicial completado. {len(movies_lists)} películas cacheadas.")
    except Exception as e:
        print(f"[ERROR] Scraping inicial falló: {e}")

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
        return {"data": json.loads(cached_data), "source": "cache"}
    return {"data": None, "source": "api"}

async def shutdown():
    await controller.close()
    redis.close()

if __name__ == "__main__":
    asyncio.run(startup())