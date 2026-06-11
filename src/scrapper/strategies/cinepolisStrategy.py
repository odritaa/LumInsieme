from utils.strategyScrapping import StrategyScrapping
from utils.movieData import MovieData

class CinepolisStrategy(StrategyScrapping):
    def __init__(self):
        super().__init__()
    
    async def doScrapping(self, page) -> list[MovieData]:
        # --- Implement the scrapping logic for Cinepolis website --- #
        pass