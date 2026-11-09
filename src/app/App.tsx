import { Route, Routes } from 'react-router';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Modes } from './pages/Modes';
import { NotFound } from './pages/NotFound';
import { Join } from './pages/Join';
import { Login } from './pages/Login';
import { Account } from './pages/Account';
import { Cup } from './pages/Cup';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { Rules } from './pages/Rules';
import { Chapter2008 } from './pages/Chapter2008';
import { Road } from './pages/Road';
import { Challenge } from './pages/Challenge';
import { Legal } from './pages/Legal';
import { About } from './pages/About';
import { Legacy } from './pages/Legacy';
import { Birthday } from './pages/Birthday';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play" element={<Play />} />
      <Route path="/legacy" element={<Legacy />} />
      {/* Canonical home is birthday.goldenrun.fun (see BirthdayApp); this path serves dev and previews. */}
      <Route path="/birthday" element={<Birthday />} />
      <Route path="/birthday/:slug" element={<Birthday />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/2008" element={<Chapter2008 />} />
      <Route path="/road-to-1000" element={<Road />} />
      <Route path="/c/:runId" element={<Challenge />} />
      <Route path="/terms" element={<Legal page="terms" />} />
      <Route path="/privacy" element={<Legal page="privacy" />} />
      <Route path="/about" element={<About />} />
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

/** birthday.goldenrun.fun: just the birthday page, without the game's account bootstrap. */
export function BirthdayApp() {
  return (
    <Routes>
      <Route path="/" element={<Birthday />} />
      <Route path="/:slug" element={<Birthday />} />
    </Routes>
  );
}
