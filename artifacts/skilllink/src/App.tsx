import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { DashboardPage, AuthPage, FundiProfilePage, HomePage, HowItWorksPage, NotFoundPage, SearchPage } from '@/pages/skilllink-pages';

const queryClient = new QueryClient();

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomePage} />
    <Route path="/search" component={SearchPage} />
    <Route path="/how-it-works" component={HowItWorksPage} />
    <Route path="/auth" component={AuthPage} />
    <Route path="/dashboard" component={DashboardPage} />
    <Route path="/fundi/:id" component={FundiProfilePage} />
    <Route component={NotFoundPage} />
  </Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;