
import datetime

from utils.strategyScrapping import StrategyScrapping
from utils.movieData import MovieData
from playwright.async_api import TimeoutError, Error as PlaywrightError, expect


class MultiplexStrategy(StrategyScrapping):
    URL = "https://www.multiplex.com.ar/"
    def __init__(self):
        super().__init__()
    async def extractScreenings(self, context) -> list[dict]:
        screenings: list[dict] = []
        for format in context:
            try:
                hoursScreenings = []
                type = await format.query_selector("formato-idioma > span").inner_text().strip()
                for hours in await format.query_selector_all("contenedor-horas > span"):
                    if not await self.isHidden(hours) and not await self.containsClass(hours, "horario-desactivado"):
                        hoursScreenings.append(hours.inner_text().strip())
                
                screenings.append({"type": type, "hours": hoursScreenings})
                return screenings

            except PlaywrightError as e:
                print(f"[ELEMENT NOT FOUND] Could not find title for movie: {e}")
                pass
            
        

    async def doScrapping(self, page) -> list[MovieData]:
        moviesData: list[MovieData] = []
        await page.goto(self.URL)

        try:
            # Step 1 — Select cinema complex
            await page.wait_for_selector(
                "label[class='btn-complejo']",
                state="attached",
                timeout=15000
            )
            cineButtons = await page.query_selector_all("label[class='btn-complejo']")
            if len(cineButtons) < 2:
                raise TimeoutError(
                    "Expected at least 2 elements for 'label[class=\"btn-complejo\"]'"
                )
            await cineButtons[1].click()

            # Step 2 — Get day selectors
            await page.wait_for_selector(
                "div[class='swiper-slide']",
                state="attached",
                timeout=15000
            )
            daysButtonSelector = await page.query_selector_all("div[class='swiper-slide']")

            for day in daysButtonSelector:
                await day.click() # Select the day to load the movies for that day

                await day.wait_for_selector("fecha-label", state="attached", timeout=5000)
                fechaLabel = await day.query_selector("fecha-label")
                await fechaLabel.wait_for_selector("btn-date", state="attached", timeout=5000)
                btnDate = await fechaLabel.query_selector("btn-date")
                dateDivs = await btnDate.query_selector_all("div")
                if len(dateDivs) < 2:
                    raise TimeoutError("Expected at least 2 'div' inside 'btn-date'")
                dateSpans = await dateDivs[1].query_selector_all("span")
                if len(dateSpans) < 2:
                    raise TimeoutError(
                        "Expected at least 2 'span' inside 'btn-date > div:nth-child(2)'"
                    )
                month = await dateSpans[0].inner_text()
                dayNumber = await dateSpans[1].inner_text()
                month, dayNumber = [month.strip(), int(dayNumber.strip())]
                
                fechaEnd = datetime.now().replace(month=self.monthToNumber(month), day=dayNumber)
                funcionesList = await page.query_selector(
                    "#funciones-list", state="attached", timeout=5000)
                if not funcionesList:
                    raise TimeoutError("Could not find element with selector '#funciones-list'")
                
                for movie in funcionesList.query_selector_all("div[class='funcion-item visible']"):
                    title = await movie.query_selector("bloque-formatos > a > h4").inner_text().strip()

                    try:
                        formatos = [screening for screening in await movie.query_selector_all("formato-idioma ") if not await self.isHidden(screening)]
                        screenings = await self.extractScreenings(formatos)
                        moviesData.append(MovieData(title, screenings, "1 hora", "Multiplex Belgrano"))
                    except PlaywrightError as e:
                        print(f"[ELEMENT NOT FOUND] Could not find title for movie: {e}")
                        pass

                return moviesData


        except TimeoutError as e:
            print(f"[ELEMENT NOT FOUND] {e}")
            raise
        except PlaywrightError as e:
            print(f"[ELEMENT NOT CLICKABLE / ACTION FAILED] {e}")
            raise


        
