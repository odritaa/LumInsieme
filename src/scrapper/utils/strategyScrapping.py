from abc import ABC, abstractmethod
from types import CoroutineType

class StrategyScrapping(ABC):
    @abstractmethod
    def doScrapping(self, context: CoroutineType) -> dict:
        """Method to be implemented by the concrete strategy classes to perform the scrapping logic."""
        pass