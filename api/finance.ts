import { handle } from "./_core.js";

declare const process: { env: Record<string, string | undefined> };

// Vercel Function: POST /api/finance with a JSON body naming the action.
export function POST(request: Request) {
  return handle(request, process.env);
}
