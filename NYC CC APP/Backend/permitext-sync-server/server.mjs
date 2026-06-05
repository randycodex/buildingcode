import { createServer } from "node:http";
import { handleRequest } from "./app.mjs";

const port = Number(process.env.PORT || 8787);
const server = createServer(handleRequest);

server.listen(port, () => {
  console.log(`Permitext sync server listening on http://localhost:${port}`);
  console.log(`Data file: ${process.env.PERMITEXT_SYNC_DATA_PATH || "data/sync-store.json"}`);
});
