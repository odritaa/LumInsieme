import { AppProvider, useAppContext } from "./contexts/AppContext";
import Landing from "./components/Landing";
import Profile from "./components/Profile";
import Dashboard from "./components/Dashboard";
import Chat from "./components/Chat";

function AppContent() {
  const { view } = useAppContext();

  switch (view) {
    case "landing":
      return <Landing />;
    case "profile":
      return <Profile />;
    case "dashboard":
      return <Dashboard />;
    case "chat":
      return <Chat />;
    default:
      return <Landing />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
