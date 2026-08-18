import "./style.css";

import { render } from "preact";
import { LocationProvider, Router, Route } from "preact-iso";
import { AppProvider } from "./context";

import Header from "./components/Header.jsx";

import NotFound from "./pages/_404.jsx";

import Home from "./pages/Home/index.jsx";

export function App() {
  return (
    <AppProvider>
      <LocationProvider>
        <Header />
        <main>
          <Router>
            <Route path="/" component={Home} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </LocationProvider>
    </AppProvider>
  );
}

render(<App />, document.getElementById("app")!);
