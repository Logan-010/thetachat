import "./style.css";

import { render } from "preact";
import { LocationProvider, Router, Route, lazy } from "preact-iso";
import { AppProvider } from "./context";

import Header from "./components/Header.jsx";

import NotFound from "./pages/_404.jsx";

const Home = lazy(() => import("./pages/Home"));
const Save = lazy(() => import("./pages/Save"));

export function App() {
  return (
    <AppProvider>
      <LocationProvider>
        <Header />
        <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Router>
            <Route path="/" component={Home} />
            <Route path="/save" component={Save} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </LocationProvider>
    </AppProvider>
  );
}

render(<App />, document.getElementById("app")!);
