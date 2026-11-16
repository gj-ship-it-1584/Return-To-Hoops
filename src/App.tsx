import type { ReactNode } from 'react';
import { useRoute, go } from './lib/hooks';
import { ToastHost } from './components/ui';
import Today from './screens/Today';
import Workout from './screens/Workout';
import Library from './screens/Library';
import ExerciseDetail from './screens/ExerciseDetail';
import BodyLog from './screens/BodyLog';
import Trends from './screens/Trends';
import SettingsScreen from './screens/Settings';

const TABS: { id: string; label: string; icon: ReactNode }[] = [
  { id: '', label: 'Today', icon: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /> },
  { id: 'library', label: 'Library', icon: <path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8-1 3.9 15.5-3.8 1z" /> },
  { id: 'body', label: 'Body', icon: <path d="M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7 10h10l-1.5 6H14l-.5 5h-3l-.5-5H8.5z" /> },
  { id: 'trends', label: 'Trends', icon: <path d="M3 19h18M5 15l4-5 4 3 6-8" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> },
  { id: 'settings', label: 'Settings', icon: <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM10.5 2h3l.5 2.6 2.3 1 2.2-1.5 2.1 2.1-1.5 2.2 1 2.3 2.6.5v3l-2.6.5-1 2.3 1.5 2.2-2.1 2.1-2.2-1.5-2.3 1-.5 2.6h-3l-.5-2.6-2.3-1-2.2 1.5-2.1-2.1 1.5-2.2-1-2.3L2 13.5v-3l2.6-.5 1-2.3-1.5-2.2 2.1-2.1 2.2 1.5 2.3-1z" fillRule="evenodd" /> },
];

export default function App() {
  const [page, ...rest] = useRoute();
  if (page === 'workout') return (<><Workout /><ToastHost /></>);
  let screen: ReactNode;
  switch (page) {
    case 'library':
      screen = rest[0] ? <ExerciseDetail id={rest[0]} /> : <Library />;
      break;
    case 'body':
      screen = <BodyLog />;
      break;
    case 'trends':
      screen = <Trends />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    default:
      screen = <Today />;
  }
  const active = page ?? '';
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="safe-top px-4 pb-28">{screen}</main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => {
            const on = active === t.id || (t.id === '' && !TABS.some((x) => x.id && x.id === active));
            return (
              <button key={t.id} type="button" onClick={() => go(t.id)} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? 'text-accent' : 'text-faint'}`}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0">
                  {t.icon}
                </svg>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <ToastHost />
    </div>
  );
}
