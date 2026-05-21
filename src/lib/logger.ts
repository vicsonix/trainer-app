import { Axiom } from "@axiomhq/js";
import { after } from "next/server";

const axiom = new Axiom({ token: process.env.AXIOM_TOKEN! });

type Level = "info" | "warn" | "error";

export function log(
  level: Level,
  message: string,
  fields?: Record<string, unknown>
) {
  axiom.ingest("trainer-app", [
    { _time: new Date().toISOString(), level, message, ...fields },
  ]);
  // flush after response is sent — never block the response path
  after(async () => {
    await axiom.flush();
  });
}
