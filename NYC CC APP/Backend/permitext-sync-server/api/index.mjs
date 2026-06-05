import { handleRequest } from "../app.mjs";

export default async function handler(request, response) {
  await handleRequest(request, response);
}
