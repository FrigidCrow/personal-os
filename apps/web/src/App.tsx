import { lazy, Suspense, useEffect, useRef } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { Redirect, Route, Switch } from "wouter";
import { useLocation } from "wouter";
import { Shell } from "./components/Shell";
import { LoadingState } from "./components/UI";
import { DashboardPage } from "./pages/DashboardPage";

const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const TasksPage = lazy(() => import("./pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const RadarPage = lazy(() => import("./pages/RadarPage").then((module) => ({ default: module.RadarPage })));
const ExperimentsPage = lazy(() => import("./pages/ExperimentsPage").then((module) => ({ default: module.ExperimentsPage })));
const AssetsPage = lazy(() => import("./pages/AssetsPage").then((module) => ({ default: module.AssetsPage })));
const ReviewPage = lazy(() => import("./pages/ReviewPage").then((module) => ({ default: module.ReviewPage })));

export function App() {
  const [location] = useLocation();
  const reduceMotion = useReducedMotion();
  const initialLoad = useRef(true);

  useEffect(() => {
    initialLoad.current = false;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Shell>
        <Suspense fallback={<LoadingState label="正在打开控制面" />}>
          <motion.div
            key={location}
            className="page-transition"
            initial={reduceMotion || initialLoad.current ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
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
          </motion.div>
        </Suspense>
      </Shell>
    </MotionConfig>
  );
}
