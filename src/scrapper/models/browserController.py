
from types import CoroutineType

from playwright.async_api import async_playwright

from utils.movieData import MovieData
from utils.strategyScrapping import StrategyScrapping

class PlaywrightBrowserController:
    _browser = None
    _context = None
    _strategy: StrategyScrapping = None
    def __new__(cls, browser, context):
        if not hasattr(cls, '_instance'):
            cls._browser = async_playwright().start().chromium.launch(headless=True)
            cls._context = cls._browser.new_context()
            cls._instance = super(PlaywrightBrowserController, cls).__new__(cls)

        return cls._instance
    
    def __init__(self, browser, context):
        if not hasattr(self, 'browser'):
            self.browser = browser
        if not hasattr(self, 'context'):
            self.context = context
    
    async def _new_page(self):
        return await self.context.new_context().new_page()
    
    async def scrapper_page(self, strategy: StrategyScrapping) -> list[MovieData]:
        page_context: CoroutineType = await self._new_page()
        responseInfo:list[MovieData] = await strategy.doScrapping(page_context)
        return responseInfo

    async def run():
        BrowserController = PlaywrightBrowserController()
        stretegies:list[StrategyScrapping] = [] # --- Load the strategies later.... --- #
        # --- Load the strategy later.... --- #
        task = [BrowserController.scrapper_page(strategy) for strategy in stretegies]

        # await asyncio.gather(*task)
        # await BrowserController.close()

    # --- Close the browser ---#
    async def close(self):
        await self.browser.close()