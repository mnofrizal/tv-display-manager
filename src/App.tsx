import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TVDisplay from "./components/TVDisplay";
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tv/:id" element={<TVDisplay />} />
      </Routes>
    </Router>
  );
}

export default App;
