import path from "node:path";
import { serve } from "@get-on/site-server/node";

const rootDir = path.resolve(
  process.env.LOCAL_SITES_DIR || path.join(process.cwd(), ".local-sites"),
);
const port = Number(process.env.PUBLISH_PORT || 8787);
const rootDomain = process.env.LOCAL_ROOT_DOMAIN || "localhost";

serve({ rootDir, port, rootDomain });
