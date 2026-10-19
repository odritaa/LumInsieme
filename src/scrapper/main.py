import asyncio
import json

from utils.config import SCRAPER_CONFIG
from models.browserController import PlaywrightBrowserController
from strategies.multiplexScrapping import MultiplexStrategy
from grpc_client import CacheClient

CACHE_TTL = SCRAPER_CONFIG["cache_ttl"]
CACHE_KEY = "scraped_data"


async def run_initial_scrape():
    controller = PlaywrightBrowserController()
    cache_client = CacheClient()
    try:
        cache_client.connect()
        await controller.start()

        strategies = [MultiplexStrategy()]
        tasks = [controller.scrapper_page(s) for s in strategies]
        movies_lists = await asyncio.gather(*tasks)

        serialized = PlaywrightBrowserController._serialize(movies_lists)
        payload = json.dumps(serialized, indent=2, ensure_ascii=False)

        ok = await cache_client.set_with_ttl(CACHE_KEY, payload, CACHE_TTL)
        if ok:
            print(f"[INFO] Scraping completado. Datos cacheados en '{CACHE_KEY}' con TTL de {CACHE_TTL}s.")
        else:
            print("[ERROR] El cache-controller no confirmó el almacenamiento.")
    except Exception as e:
        print(f"[ERROR] Scraping inicial falló: {e}")
    finally:
        await controller.close()
        await cache_client.close()


if __name__ == "__main__":
    asyncio.run(run_initial_scrape())
