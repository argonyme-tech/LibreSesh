import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BuildInfo } from './components/BuildInfo';
import { ProposalBoard } from './components/ProposalBoard';
import { ToastProvider } from './components/ui';
import { AdminPage } from './pages/AdminPage';
import { EventListPage } from './pages/EventListPage';
import { MimirPage } from './pages/MimirPage';
import { NewEventPage } from './pages/NewEventPage';
import { ProfilePage } from './pages/ProfilePage';
import { SchedulePage } from './pages/SchedulePage';
import { MeProvider, useMe } from './lib/useMe';

function Chrome() {
  const { me } = useMe();
  return <BuildInfo demo={me?.demoMode === true} />;
}

export function App() {
  return (
    <BrowserRouter>
      <MeProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<EventListPage />} />
          <Route path="/new" element={<NewEventPage />} />
          <Route path="/e/:slug" element={<SchedulePage />} />
          {/* Session detail is deep-linkable and renders over the schedule. */}
          <Route path="/e/:slug/s/:sessionId" element={<SchedulePage />} />
          <Route path="/e/:slug/proposals" element={<ProposalBoard />} />
          <Route path="/e/:slug/mimir" element={<MimirPage />} />
          <Route path="/e/:slug/p/:personId" element={<ProfilePage />} />
          <Route path="/e/:slug/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Chrome />
      </ToastProvider>
      </MeProvider>
    </BrowserRouter>
  );
}
