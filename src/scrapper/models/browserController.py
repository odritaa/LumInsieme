
from types import CoroutineType
import asyncio
import json

from playwright.async_api import async_playwright


from utils.movieData import MovieData
from utils.strategyScrapping import StrategyScrapping
from strategies.multiplexScrapping import MultiplexStrategy



class PlaywrightBrowserController:
    _browser = None
    _context = None
    _strategy: StrategyScrapping = None
    def __new__(cls):
        if not hasattr(cls, '_instance'):
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        pass
    
    async def is_running(self):
        return self._browser is not None and self._context is not None

    async def start(self):
        playwright = await async_playwright().start()
        self._browser = await playwright.chromium.launch(headless=True)
        self._context = await self._browser.new_context()

    async def _new_page(self):
        return await self._context.new_page()
    
    async def scrapper_page(self, strategy: StrategyScrapping) -> list[MovieData]:
        page_context: CoroutineType = await self._new_page()
        responseInfo:list[MovieData] = await strategy.doScrapping(page_context)
        return responseInfo

    @staticmethod
    def _serialize(obj):
        if isinstance(obj, MovieData):
            return {
                "title": obj.title,
                "date": obj.date.strftime("%Y-%m-%d"),
                "duration": obj.duration,
                "theater": obj.theater,
                "screenings": obj.screenings,
            }
        if isinstance(obj, dict):
            return {k: PlaywrightBrowserController._serialize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [PlaywrightBrowserController._serialize(item) for item in obj]
        return obj

    async def run(self):
        stretegies:list[StrategyScrapping] = [MultiplexStrategy()] # --- Load the strategies later.... --- #
        # --- Load the strategy later.... --- #
        task = [self.scrapper_page(strategy) for strategy in stretegies]

        moviesDataDays = await asyncio.gather(*task)
        
        serialized = PlaywrightBrowserController._serialize(moviesDataDays)
        with open("moviesData.json", "w", encoding="utf-8") as f:
            json.dump(serialized, f, indent=2, ensure_ascii=False)
        
        await self.close()

    # --- Close the browser ---#
    # Si start() fallo no hay nada que cerrar: un AttributeError aca taparia el error original.
    async def close(self):
        if self._context is not None:
            await self._context.close()
        if self._browser is not None:
            await self._browser.close()
        self._context = None
        self._browser = None
if __name__ == "__main__":
    asyncio.run(PlaywrightBrowserController.run())