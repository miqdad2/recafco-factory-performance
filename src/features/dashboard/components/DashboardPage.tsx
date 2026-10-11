import { initialFailureText } from '../labels';
import { usePeriodSelection } from '../usePeriodSelection';
import { DashboardPlaceholder } from './DashboardPlaceholder';
import { DashboardScreen } from './DashboardScreen';

export function DashboardPage() {
  const selection = usePeriodSelection('daily');

  switch (selection.status) {
    case 'loading':
      return <DashboardPlaceholder mode="loading" selectedPeriod={selection.requested} />;
    case 'error':
      return (
        <DashboardPlaceholder
          mode="error"
          selectedPeriod={selection.requested}
          message={initialFailureText(selection.error)}
          onRetry={selection.retry}
        />
      );
    case 'ready':
      return <DashboardScreen selection={selection} />;
  }
}
