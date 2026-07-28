import { lazy, Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import { Shell } from "./components/Shell";
import { LoadingState } from "./components/UI";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const TasksPage = lazy(() => import("./pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const RadarPage = lazy(() => import("./pages/RadarPage").then((module) => ({ default: module.RadarPage })));
const ExperimentsPage = lazy(() => import("./pages/ExperimentsPage").then((module) => ({ default: module.ExperimentsPage })));
const AssetsPage = lazy(() => import("./pages/AssetsPage").then((module) => ({ default: module.AssetsPage })));
const ReviewPage = lazy(() => import("./pages/ReviewPage").then((module) => ({ default: module.ReviewPage })));

export function App() {
  return (
    <Shell>
      <Suspense fallback={<LoadingState label="正在打开控制面" />}>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/radar" component={RadarPage} />
          <Route path="/experiments" component={ExperimentsPage} />
          <Route path="/assets" component={AssetsPage} />
          <Route path="/review" component={ReviewPage} />
          <Route><Redirect to="/" /></Route>
        </Switch>
      </Suspense>
    </Shell>
  );
}
