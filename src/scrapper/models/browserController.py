
from types import CoroutineType
import asyncio

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
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context()

    async def _new_page(self):
        return await self.context.new_page()
    
    async def scrapper_page(self, strategy: StrategyScrapping) -> list[MovieData]:
        page_context: CoroutineType = await self._new_page()
        responseInfo:list[MovieData] = await strategy.doScrapping(page_context)
        return responseInfo

    async def run(self):
        stretegies:list[StrategyScrapping] = [MultiplexStrategy()] # --- Load the strategies later.... --- #
        # --- Load the strategy later.... --- #
        task = [self.scrapper_page(strategy) for strategy in stretegies]

        movies = await asyncio.gather(*task)
        print(f"[DEBUG] Movies data: \n----------------------\n")
        for movieData in movies:
            for movie in movieData:
                print(movie)
                print("----------------------")
        await self.close()

    # --- Close the browser ---#
    async def close(self):
        await self.context.close()
        await self.browser.close()
if __name__ == "__main__":
    asyncio.run(PlaywrightBrowserController.run())