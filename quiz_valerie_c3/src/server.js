import "dotenv/config";
import app from "./app.js";
import { ensureAdminUser } from "./db/database.js";

const port = Number(process.env.PORT) || 3000;

try {
  ensureAdminUser();
  app.listen(port, () => {
    console.log(`Survey API listening on port ${port}`);
  });
} catch (error) {
  console.error(`Unable to start the Survey API: ${error.message}`);
  process.exitCode = 1;
}
