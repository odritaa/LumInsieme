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

<<<<<<< HEAD
@app.on_event("startup")
async def startup():
    await controller.start()
    asyncio.create_task(run_initial_scrape())
=======
async def startup():
    await controller.start()
    await controller.run()
>>>>>>> 1d517e3fda1feb8d62af3b85ad9998aa96f97dc6

async def run_initial_scrape():
    try:
        strategies = [MultiplexStrategy()]
        tasks = [controller.scrapper_page(s) for s in strategies]
        movies_lists = await asyncio.gather(*tasks)

<<<<<<< HEAD
        all_movies = []
        for movie_list in movies_lists:
            for m in movie_list:
                all_movies.append({
                    "title": m.title,
                    "date": m.date.isoformat(),
                    "screenings": m.screenings,
                    "duration": m.duration,
                    "theater": m.theater
                })

        redis.setex("scraped_data", CACHE_TTL, json.dumps(all_movies))
        print(f"[INFO] Scraping inicial completado. {len(all_movies)} películas cacheadas.")
=======
        #redis.setex("scraped_data", CACHE_TTL, json.dumps(all_movies))
        print(f"[INFO] Scraping inicial completado. {len(movies_lists)} películas cacheadas.")
>>>>>>> 1d517e3fda1feb8d62af3b85ad9998aa96f97dc6
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

<<<<<<< HEAD
@app.on_event("shutdown")
=======
>>>>>>> 1d517e3fda1feb8d62af3b85ad9998aa96f97dc6
async def shutdown():
    await controller.close()
    redis.close()

if __name__ == "__main__":
<<<<<<< HEAD
    import uvicorn
    uvicorn.run(app, host=SERVER_CONFIG["host"], port=SERVER_CONFIG["port"])
=======
    asyncio.run(startup())
>>>>>>> 1d517e3fda1feb8d62af3b85ad9998aa96f97dc6
