export interface Player {
  defId: number
  name: string
  url: string
  price: number | null       // price shown on the fut.gg card
  maxBuy?: number            // undefined = use price, 0 = no limit
}

export interface Queue {
  team: string               // e.g. "Charlton"
  players: Player[]
  index: number              // current player
  done: number[]             // defIds already opened
}

export type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "open" }
  | { kind: "openFailed" }

/** Health of the Web App connection, checked continuously. */
export type Connection = "ready" | "loading" | "loggedOut" | "offline" | "broken"
