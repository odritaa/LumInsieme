export const mockMovies = [
  {
    title: "Metrópolis",
    place: "Cine Capitol",
    screenings: [
      { type: "Subtitulada 2D", hours: ["15:30", "18:00", "20:30"] },
      { type: "Doblada 2D", hours: ["16:00", "19:00"] },
    ],
    duration: "2h 30min",
    date: "2026-07-14",
  },
  {
    title: "Casablanca",
    place: "Sala Lumière",
    screenings: [
      { type: "Subtitulada 2D", hours: ["14:00", "17:00", "22:00"] },
    ],
    duration: "1h 42min",
    date: "2026-07-14",
  },
  {
    title: "Los Olvidados",
    place: "Cine Arte",
    screenings: [
      { type: "2D", hours: ["16:30", "19:30"] },
      { type: "Doblada 2D", hours: ["21:00"] },
    ],
    duration: "1h 25min",
    date: "2026-07-14",
  },
  {
    title: "El Ciudadano",
    place: "Multiplex Belgrano",
    screenings: [
      { type: "Subtitulada 2D", hours: ["13:00", "15:30", "18:00", "20:30"] },
    ],
    duration: "1h 59min",
    date: "2026-07-14",
  },
  {
    title: "Nosferatu",
    place: "Cine Gótico",
    screenings: [
      { type: "Muda con música", hours: ["20:00", "22:30"] },
    ],
    duration: "1h 34min",
    date: "2026-07-14",
  },
];

export const mockRooms = [
  {
    id: 1,
    movie: "Metrópolis",
    place: "Cine Capitol",
    date: "2026-07-14",
    time: "21:00",
    host: "Auguste",
    members: 3,
  },
  {
    id: 2,
    movie: "Casablanca",
    place: "Sala Lumière",
    date: "2026-07-16",
    time: "19:30",
    host: "Louis",
    members: 8,
  },
];

export const mockMessages = [
  {
    id: 1,
    user: "Sistema",
    text: "¡Bienvenidos a la sala! Coordinen su encuentro aquí.",
  },
];
