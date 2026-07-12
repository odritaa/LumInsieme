
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
                type = await format.locator("span").first.inner_text()
                contentHours = format.locator("div[class='contenedor-horas']")
                await contentHours.locator("span.horario-btn").first.wait_for(state="attached", timeout=TIMEOUT)
                hoursElements = await contentHours.locator("span.horario-btn:not(.horario-desactivado):visible").all()
                for hours in hoursElements:
                    is_class_disabled = await self.containsClass(hours, "horario-desactivado")
                    if not is_class_disabled:
                        hoursText = await hours.inner_text()
                        hoursScreenings.append(hoursText.strip())
                
                screenings.append({"type": type, "hours": hoursScreenings})

            except PlaywrightError as e:
                print(f"[ELEMENT NOT FOUND] Could not find title for movie: {e}")
                pass
        return screenings
    

    async def doScrapping(self, page) -> list[MovieData]:
        moviesData: list[MovieData] = []
        await page.goto(self.URL)

        try:
            popupClose = page.locator("a[class='dialog-close-button dialog-lightbox-close-button']")
            await popupClose.wait_for(state="attached", timeout=TIMEOUT)
            await popupClose.click() # Close the popup if it appears
            # Step 1 — Select cinema complex
            cineButtons = page.locator("label[class='btn-complejo']")
            await cineButtons.first.wait_for(state="attached", timeout=TIMEOUT)
            if await cineButtons.count() < 2:
                raise TimeoutError(
                    "Expected at least 2 elements for 'label[class=\"btn-complejo\"]'"
                )
            await cineButtons.nth(1).click()

            # Step 2 — Get day selectors
            dayLabels = page.locator("label.fecha-label")
            dayCount = await dayLabels.count()

            for i in range(min(dayCount, 5)):
                dayLabel = dayLabels.nth(i)
                await dayLabel.click()

                hiddenInput = dayLabel.locator("input[name='dia']")
                dateValue = await hiddenInput.get_attribute("value")
                mes, dia, anio = dateValue.split(".")
                fechaEnd = datetime(int(anio), int(mes), int(dia))
                funcionesList = page.locator("div[id='funciones-list']")
                await funcionesList.wait_for(state="attached", timeout=TIMEOUT)
                funciones = funcionesList.locator("div[class='funcion-item visible']")
                for movie in await funciones.all():
                    title = await movie.locator("h4").first.inner_text()
                    try:
                        formatos = movie.locator("div[class='formato-idioma']:visible")
                        screenings = await self.extractScreenings(await formatos.all())
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


        
