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
import History from './screens/History';
import Schedule from './screens/Schedule';
import DayView from './screens/DayView';

const TABS: { id: string; label: string; icon: ReactNode }[] = [
  { id: '', label: 'Today', icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17M6 6c3 2.5 3 9.5 0 12M18 6c-3 2.5-3 9.5 0 12" /></> },
  { id: 'history', label: 'History', icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></> },
  { id: 'library', label: 'Library', icon: <path d="M4.5 5.5c2.5-1 5-1 7.5.5 2.5-1.5 5-1.5 7.5-.5v13c-2.5-1-5-1-7.5.5-2.5-1.5-5-1.5-7.5-.5zM12 6v13" /> },
  { id: 'body', label: 'Body', icon: <><circle cx="12" cy="5.5" r="2.5" /><path d="M6 10.5h12M12 10.5v4.5M12 15l-3 5.5M12 15l3 5.5" /></> },
  { id: 'trends', label: 'Trends', icon: <path d="M3.5 19.5h17M5 15.5l4.5-5 3.5 3 6-7" /> },
];

export default function App() {
  const [page, ...rest] = useRoute();
  if (page === 'workout') return (<><Workout /><ToastHost /></>);
  if (page === 'history' && rest[0]) return (<><Workout id={rest[0]} /><ToastHost /></>);
  let screen: ReactNode;
  switch (page) {
    case 'library':
      screen = rest[0] ? <ExerciseDetail id={rest[0]} /> : <Library />;
      break;
    case 'history':
      screen = <History />;
      break;
    case 'plan':
      screen = <Schedule />;
      break;
    case 'day':
      screen = rest[0] ? <DayView key={rest[0]} date={rest[0]} /> : <Schedule />;
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
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => {
            const on = active === t.id || (t.id === '' && !TABS.some((x) => x.id && x.id === active));
            return (
              <button key={t.id} type="button" onClick={() => go(t.id)} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-[3px] text-[10px] font-normal tracking-[0.06em] ${on ? 'text-accent' : 'text-faint'}`}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
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
