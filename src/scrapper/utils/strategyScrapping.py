from abc import ABC, abstractmethod
from types import CoroutineType

class StrategyScrapping(ABC):
    @abstractmethod
    def doScrapping(self, context: CoroutineType) -> dict:
        """Method to be implemented by the concrete strategy classes to perform the scrapping logic."""
        pass
    @abstractmethod
    def extractScreenings(self, context: CoroutineType) -> list[dict]:
        """Method to be implemented by the concrete strategy classes to extract screenings from the page."""
        pass

    def isHidden(self, element) -> bool:
        """Check if the given element is hidden."""
        return element.evaluate_handle("""
            (element)=>{
                const style = window.getComputedStyle(element);
                return (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0');
            }
        """)
    
    def containsClass(self, element, className) -> bool:
        """Check if the given element contains the specified class."""
        return element.evaluate(f"""element => element.classList.contains('{className}')""")