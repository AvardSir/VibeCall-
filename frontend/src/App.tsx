import type { JSX } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TopBar, useApplyUiPreferences } from './features/preferences';
import { InvalidLinkScreen } from './features/room-states';
import { LandingPage } from './pages/LandingPage';
import { RoomPage } from './pages/RoomPage';

export function App(): JSX.Element {
  useApplyUiPreferences();
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/r/:roomId" element={<RoomPage />} />
        <Route path="*" element={<InvalidLinkScreen />} />
      </Routes>
    </>
  );
}
