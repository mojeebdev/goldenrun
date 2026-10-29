import { Route, Routes } from 'react-router';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Modes } from './pages/Modes';
import { Upcoming } from './pages/Upcoming';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play" element={<Play />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/2008" element={<Upcoming path="/2008" />} />
      <Route path="/road-to-1000" element={<Upcoming path="/road-to-1000" />} />
      <Route path="/cup" element={<Upcoming path="/cup" />} />
      <Route path="/leaderboard" element={<Upcoming path="/leaderboard" />} />
      <Route path="/u/:username" element={<Upcoming path="/u" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
