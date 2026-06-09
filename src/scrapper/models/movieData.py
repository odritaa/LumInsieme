from datetime import datetime

class MovieData:
    def __init__(self, title:str, screenings:list[datetime], duration:str, theater:str ):
        self.title = title
        self.screenings = screenings
        self.duration = duration
        self.theater = theater
    
