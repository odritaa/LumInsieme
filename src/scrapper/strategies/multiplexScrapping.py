
from datetime import datetime

from utils.strategyScrapping import StrategyScrapping
from utils.movieData import MovieData
from playwright.async_api import TimeoutError, Error as PlaywrightError, expect

TIMEOUT=5000 # 5 seconds
class MultiplexStrategy(StrategyScrapping):
    URL = "https://www.multiplex.com.ar/"
    def __init__(self):
        super().__init__()
    
    async def extractScreenings(self, context) -> list[dict]:
        screenings: list[dict] = []
        for format in context:
            try:
                hoursScreenings = []
                type = await format.query_selector("span")
                type = await type.inner_text()
                for hours in await format.query_selector_all("div[class='contenedor-horas'] > span"):
                    if not await self.isHidden(hours) and not await self.containsClass(hours, "horario-desactivado"):
                        hour = await hours.inner_text()
                        print(f"[DEBUG] {type.strip()}->{hour.strip()}")
                        hoursScreenings.append(hour.strip())
                
                screenings.append({"type": type, "hours": hoursScreenings})
                return screenings

            except PlaywrightError as e:
                print(f"[ELEMENT NOT FOUND] Could not find title for movie: {e}")
                pass
    
    def monthToNumber(self, month: str) -> int:
        match month:
            case "ENE": return 1
            case "FEB": return 2
            case "MAR": return 3
            case "ABR": return 4
            case "MAY": return 5
            case "JUN": return 6
            case "JUL": return 7
            case "AGO": return 8
            case "SEP": return 9
            case "OCT": return 10
            case "NOV": return 11
            case "DIC": return 12
        return -1       
        

    async def doScrapping(self, page) -> list[MovieData]:
        moviesData: list[MovieData] = []
        await page.goto(self.URL)

        try:
            popupClose = await page.wait_for_selector(
                "a[class='dialog-close-button dialog-lightbox-close-button']", 
                state="attached",
                timeout=TIMEOUT
                )
            await popupClose.click() # Close the popup if it appears
            # Step 1 — Select cinema complex
            await page.wait_for_selector(
                "label[class='btn-complejo']",
                state="attached",
                timeout=TIMEOUT
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
                timeout=TIMEOUT
            )
            daysButtonSelector = await page.query_selector_all("div[class='swiper-slide']")

            for day in daysButtonSelector:
                await day.click() # Select the day to load the movies for that day

                await day.wait_for_selector("label[class='fecha-label']", state="attached", timeout=TIMEOUT)
                fechaLabel = await day.query_selector("label[class='fecha-label']")
                await fechaLabel.wait_for_selector("div[class='btn-date']", state="attached", timeout=TIMEOUT)
                btnDate = await fechaLabel.query_selector(".btn-date")
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
                await page.wait_for_selector("div[id='funciones-list']", state="attached", timeout=TIMEOUT)
                funcionesList = await page.query_selector("div[id='funciones-list']")
                if not funcionesList:
                    raise TimeoutError("Could not find element with selector '#funciones-list'")
                funciones = await funcionesList.query_selector_all("div[class='funcion-item visible']")
                for movie in funciones:
                    title = await movie.query_selector("h4")
                    title = await title.inner_text()
                    try:
                        formatos = await movie.query_selector_all("div[class='formato-idioma']:visible")
                        #formatos = [screening for screening in formatos if not await self.isHidden(screening)]
                        screenings = await self.extractScreenings(formatos)
                        moviesData.append(MovieData(title.strip(), fechaEnd, screenings, "1 hora", "Multiplex Belgrano"))
                    except PlaywrightError as e:
                        print(f"[ELEMENT NOT FOUND] screenings error not found: {e}")
                        pass

                return moviesData


        except TimeoutError as e:
            print(f"[ELEMENT NOT FOUND] {e}")
            raise
        except PlaywrightError as e:
            print(f"[ELEMENT NOT CLICKABLE / ACTION FAILED] {e}")
            raise


        
