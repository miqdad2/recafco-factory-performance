import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardPage } from './features/dashboard/components/DashboardPage';

export default function App() {
  return (
    <ErrorBoundary>
      <DashboardPage />
    </ErrorBoundary>
  );
}
