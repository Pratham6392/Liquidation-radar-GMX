import { PORT } from "./config";
import { app } from "./app";

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server listening on port ${PORT}`);
});

