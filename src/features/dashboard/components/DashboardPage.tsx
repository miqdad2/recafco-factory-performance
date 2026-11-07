import { initialFailureText } from '../labels';
import { useDashboardSelection } from '../useDashboardSelection';
import { DashboardPlaceholder } from './DashboardPlaceholder';
import { DashboardScreen } from './DashboardScreen';

export function DashboardPage() {
  const selection = useDashboardSelection('daily');

  switch (selection.status) {
    case 'loading':
      return <DashboardPlaceholder mode="loading" selectedPeriod={selection.requested.period} />;
    case 'error':
      return (
        <DashboardPlaceholder
          mode="error"
          selectedPeriod={selection.requested.period}
          message={initialFailureText(selection.error)}
          onRetry={selection.retry}
        />
      );
    case 'ready':
      return <DashboardScreen selection={selection} />;
  }
}
