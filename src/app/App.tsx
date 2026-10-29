import { Route, Routes } from 'react-router';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Modes } from './pages/Modes';
import { Upcoming } from './pages/Upcoming';
import { NotFound } from './pages/NotFound';
import { Join } from './pages/Join';
import { Login } from './pages/Login';
import { Account } from './pages/Account';
import { Cup } from './pages/Cup';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { Rules } from './pages/Rules';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play" element={<Play />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/2008" element={<Upcoming path="/2008" />} />
      <Route path="/road-to-1000" element={<Upcoming path="/road-to-1000" />} />
      <Route path="/cup" element={<Cup />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/u/:username" element={<Profile />} />
      <Route path="/join" element={<Join />} />
      <Route path="/login" element={<Login />} />
      <Route path="/account" element={<Account />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
