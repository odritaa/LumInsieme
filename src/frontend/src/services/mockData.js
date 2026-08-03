/** Id del usuario propio: permite distinguir "Tú" sin depender del nombre. */
export const CURRENT_USER_ID = "me";

/** Géneros ofrecidos en el editor de perfil. */
export const GENRES = [
  "Ciencia Ficción",
  "Drama",
  "Thriller Psicológico",
  "Cine Indie",
  "Cine de Autor",
  "Romance",
  "Suspenso",
  "Animación",
  "Comedia",
  "Acción",
  "Documental",
  "Terror",
  "Fantasía",
  "Musical",
];

/** Perfil que se carga al iniciar sesión (mock: todavía no hay backend de auth). */
export const demoUser = {
  id: CURRENT_USER_ID,
  name: "Mi Perfil",
  age: 28,
  city: "Buenos Aires",
  genres: ["Ciencia Ficción", "Drama", "Thriller Psicológico", "Cine Indie", "Cine de Autor"],
  favoriteMovies: [
    { initials: "Me", title: "Metrópolis" },
    { initials: "Ca", title: "Casablanca" },
    { initials: "LO", title: "Los Olvidados" },
    { initials: "EC", title: "El Ciudadano" },
    { initials: "No", title: "Nosferatu" },
  ],
};

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
    id: "1",
    movie: "Metrópolis",
    place: "Cine Capitol",
    date: "2026-07-14",
    time: "21:00",
    host: "Auguste",
    capacity: 6,
    note: "Buscamos gente que quiera disfrutar el expresionismo alemán en pantalla grande.",
    members: [
      { id: "u1", name: "Auguste Renoir", genres: ["Ciencia Ficción", "Drama"], isAdmin: true },
      { id: "u2", name: "Marina Gómez", genres: ["Thriller Psicológico", "Cine de Autor"] },
      { id: CURRENT_USER_ID, name: "Mi Perfil", genres: ["Ciencia Ficción", "Drama"] },
    ],
  },
  {
    id: "2",
    movie: "Casablanca",
    place: "Sala Lumière",
    date: "2026-07-16",
    time: "19:30",
    host: "Louis",
    capacity: 4,
    note: "Clásico en copia restaurada. Después charlamos en el bar de al lado.",
    members: [
      { id: "u3", name: "Louis Lumière", genres: ["Drama", "Romance"], isAdmin: true },
      { id: "u4", name: "Rita Solano", genres: ["Romance", "Musical"] },
    ],
  },
  {
    id: "3",
    movie: "Los Olvidados",
    place: "Cine Arte",
    date: "2026-07-18",
    time: "18:00",
    host: "Camila",
    capacity: 5,
    note: "Ciclo de cine latinoamericano. Vamos temprano para conseguir buenos asientos.",
    members: [
      { id: "u5", name: "Camila Duarte", genres: ["Documental", "Drama"], isAdmin: true },
      { id: "u6", name: "Federico Gil", genres: ["Cine Indie", "Drama"] },
      { id: "u7", name: "Tomás Marín", genres: ["Cine de Autor"] },
      { id: "u8", name: "Lucía Paz", genres: ["Drama", "Suspenso"] },
    ],
  },
  {
    id: "4",
    movie: "Nosferatu",
    place: "Cine Gótico",
    date: "2026-07-22",
    time: "22:30",
    host: "Sofía",
    capacity: 3,
    note: "Función muda con música en vivo. Ideal para fanáticos del terror clásico.",
    members: [
      { id: "u9", name: "Sofía Vera", genres: ["Terror", "Fantasía"], isAdmin: true },
    ],
  },
];

export const mockMessages = [
  {
    id: "m1",
    roomId: "1",
    authorId: "u1",
    author: "Auguste Renoir",
    time: "19:45",
    text: "¡Hola gente! ¿Nos juntamos 15 min antes en la puerta?",
  },
  {
    id: "m2",
    roomId: "1",
    authorId: "u2",
    author: "Marina Gómez",
    time: "19:50",
    text: "Me sumo. ¿Compramos entradas ya o en el momento?",
  },
  {
    id: "m3",
    roomId: "1",
    authorId: CURRENT_USER_ID,
    author: "Mi Perfil",
    time: "19:52",
    text: "Yo compro las mías online, así aseguramos butacas juntas.",
  },
  {
    id: "m4",
    roomId: "2",
    authorId: "u3",
    author: "Louis Lumière",
    time: "18:10",
    text: "¡Bienvenidos a la sala! Coordinemos el encuentro acá.",
  },
];
