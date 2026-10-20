import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { fetchCarteleraDay } from "../services/carteleraService";
import Navbar from "../components/Navbar";
import RoomCard from "../components/RoomCard";
import DaySelector from "../components/DaySelector";
import ScreeningTimeline from "../components/ScreeningTimeline";

const EMPTY_CARTELERA = { dates: [], date: null, screenings: [] };

export default function Feed() {
  const { rooms, roomsStatus, roomsError, loadRooms } = useAppContext();
  const [params, setParams] = useSearchParams();
  const view = params.get("vista") === "salas" ? "salas" : "cartelera";
  const requestedDay = params.get("dia") || undefined;

  const [cartelera, setCartelera] = useState(EMPTY_CARTELERA);
  const [carteleraStatus, setCarteleraStatus] = useState("loading");
  const [carteleraError, setCarteleraError] = useState(null);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    let cancelled = false;
    setCarteleraStatus("loading");
    setCarteleraError(null);
    fetchCarteleraDay(requestedDay)
      .then((data) => {
        if (cancelled) return;
        setCartelera(data);
        setCarteleraStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setCarteleraError(err.message);
        setCarteleraStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [requestedDay]);

  // Vista y día viven en la URL: volver desde una sala conserva lo que el usuario estaba mirando.
  const updateParams = useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  const selectedDay = requestedDay ?? cartelera.date;

  return (
    <div className="page">
      <Navbar action={{ to: "/crear-sala", label: "+ Crear Sala" }} />

      <section className="feed-container">
        <div className="feed-header">
          <h1>¿Qué vemos?</h1>
          <p>Elegí una función para armar una salida o sumate a una sala abierta</p>
        </div>

        <div className="feed-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "cartelera"}
            className={`feed-tab${view === "cartelera" ? " active" : ""}`}
            onClick={() => updateParams({ vista: null })}
          >
            Cartelera
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "salas"}
            className={`feed-tab${view === "salas" ? " active" : ""}`}
            onClick={() => updateParams({ vista: "salas" })}
          >
            Salas abiertas
            {roomsStatus === "ready" && <span className="feed-tab-count">{rooms.length}</span>}
          </button>
        </div>

        {view === "cartelera" ? (
          <>
            <DaySelector
              dates={cartelera.dates}
              selected={selectedDay}
              onSelect={(date) => updateParams({ dia: date })}
            />

            {carteleraStatus === "loading" && <p className="feed-state">Cargando funciones...</p>}
            {carteleraStatus === "error" && (
              <p className="feed-state feed-state-error">
                No pudimos cargar la cartelera: {carteleraError}
              </p>
            )}
            {carteleraStatus === "ready" && cartelera.dates.length === 0 && (
              <p className="feed-state">
                La cartelera todavía no está disponible. Volvé a intentar en un rato.
              </p>
            )}
            {carteleraStatus === "ready" &&
              cartelera.dates.length > 0 &&
              cartelera.screenings.length === 0 && (
                <p className="feed-state">No hay funciones publicadas para este día.</p>
              )}
            {carteleraStatus === "ready" && cartelera.screenings.length > 0 && (
              <ScreeningTimeline date={cartelera.date} screenings={cartelera.screenings} />
            )}
          </>
        ) : (
          <>
            {roomsStatus === "loading" && rooms.length === 0 && (
              <p className="feed-state">Cargando salas...</p>
            )}
            {roomsStatus === "error" && (
              <p className="feed-state feed-state-error">No pudimos cargar las salas: {roomsError}</p>
            )}
            {roomsStatus === "ready" && rooms.length === 0 && (
              <p className="feed-state">
                Todavía no hay salas abiertas. Elegí una función de la cartelera o creá la primera
                desde + Crear Sala.
              </p>
            )}
            {rooms.length > 0 && (
              <div className="cards-grid">
                {rooms.map((room, i) => (
                  <RoomCard key={room.id} room={room} index={i} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <Link className="fab-button" to="/crear-sala" title="Crear nueva sala" aria-label="Crear nueva sala">
        +
      </Link>
    </div>
  );
}
