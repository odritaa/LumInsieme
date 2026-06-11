from utils.strategyScrapping import StrategyScrapping
from utils.movieData import MovieData

class MultiplexStrategy(StrategyScrapping):
    URL = "https://www.multiplex.com.ar/"
    def __init__(self):
        super().__init__()
    
    async def doScrapping(self, page) -> list[MovieData]:
        # --- Scrapping process steps and extract elements --- #
        # 1. Click on label: "Multiplex Belgrano"(label[class='btn-complejo'])
        # 2. Click on div with screenting's hour -> Extract {Date}
        # 3. div[class='bloque-formatos'] -> a -> h4[class='no-link-style'] Extract{Titulo de la pelicula}
        # 4. div[class='contenedor-horas'] -> span[class='no-link-style']:
        # IF:
        # ->> Display None and span[class='horario-desactivado'] -> Not extract
        # ELSE:
        # ->> span[class='horario-btn'] -> Extract {list with screentings}
        # 5. a[class='portada-link'] -> img Extract {Image}
        #
        await page.goto(self.URL)

        cineButton = await page.query_selector("label[class='btn-complejo']")[1]
        await cineButton.click()
        daysButtonSelector = await page.query_selector("div[class='swiper-slide']")

        
