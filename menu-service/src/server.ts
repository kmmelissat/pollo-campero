import { createApp } from "./app";
import { loadEnv } from "./config/env";

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, () => {
  console.log(
    `[menu-service] listening on port ${env.PORT} (NODE_ENV=${env.NODE_ENV})`,
  );
});
