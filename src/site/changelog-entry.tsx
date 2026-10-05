import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./fonts"
import "../index.css"
import Changelog from "./Changelog"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Changelog />
  </StrictMode>,
)
