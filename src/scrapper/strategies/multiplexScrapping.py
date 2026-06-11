from utils.strategyScrapping import StrategyScrapping
from utils.movieData import MovieData

class MultiplexStrategy(StrategyScrapping):
    URL = "https://www.multiplex.com.ar/"
    def __init__(self):
        super().__init__()
    
    async def doScrapping(self, page) -> list[MovieData]:
        # --- Implement the scrapping logic for Multiplex website --- #
        await page.goto(self.URL)

        cineButton = await page.query_selector("label[class='btn-complejo']")[1]
        await cineButton.click()

        
