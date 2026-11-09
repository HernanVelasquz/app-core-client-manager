/* @refresh reload */
import { render } from "solid-js/web";
import "@/app/styles.css";
import { App } from "@/app";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root was not found in the DOM");
}

render(() => <App />, rootElement);
