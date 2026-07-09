import asyncio

from models.browserController import PlaywrightBrowserController

async def main():
    scrapper = PlaywrightBrowserController()
    await scrapper.start()
    await scrapper.run()

if __name__ == "__main__":
    asyncio.run(main())