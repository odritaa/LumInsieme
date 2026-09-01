from datetime import datetime

class MovieData:
    def __init__(self, title:str, date:datetime, screenings:list[dict], duration:str, theater:str ):
        self.title = title
        self.date = date
        self.screenings = screenings
        self.duration = duration
        self.theater = theater
    
    def __str__(self):
        return f"TITULO:{self.title} \n- {self.date.strftime('%Y-%m-%d')} \n- {self.duration} \n- {self.theater} \n- Screenings: {self.screenings}"
    
