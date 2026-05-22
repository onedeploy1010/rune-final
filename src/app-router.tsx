import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";

import { AppLayout } from "@/components/layout";

import Home          from "@/pages/home";
import Projects      from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tools         from "@/pages/tools";
import Rune          from "@/pages/rune";
import B18           from "@/pages/b18";
import Hyperliquid   from "@/pages/hyperliquid";
import LegendAtm     from "@/pages/legend-atm";
import Recruit       from "@/pages/recruit";
import Resources     from "@/pages/resources";
import PublicDashboard from "@/pages/dashboard";
import Tutorial      from "@/pages/tutorial";
import NotFound      from "@/pages/not-found";

// Lazy-load the dashboard shell — it wraps its inner routes in
// <WouterRouter base="/app">, which strips the /app prefix so the inner
// Switch can match routes like "/strategy" instead of "/app/strategy".
const AppContainer = lazy(() => import("@app/dashboard-shell"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-amber-500">
      <div>Loading…</div>
    </div>
  );
}

export default function AppRouter() {
  const [location] = useLocation();
  if (location === "/app" || location.startsWith("/app/")) {
    return (
      <Suspense fallback={<Loading />}>
        <AppContainer />
      </Suspense>
    );
  }
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/rune"            component={Rune} />
        <Route path="/projects/b18"             component={B18} />
        <Route path="/projects/hyperliquid"     component={Hyperliquid} />
        <Route path="/projects/hyperliquid/:address" component={Hyperliquid} />
        <Route path="/projects/legend-atm"      component={LegendAtm} />
        <Route path="/projects/:id"             component={ProjectDetail} />
        <Route path="/tools"      component={Tools} />
        <Route path="/resources"  component={Resources} />
        <Route path="/recruit"    component={Recruit} />
        <Route path="/dashboard"  component={PublicDashboard} />
        <Route path="/tutorial"   component={Tutorial} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}
