import dotenv from "dotenv";
import { connectToDatabase } from "./src/database/connection.js";
import { startBot } from "./src/bot/bot.js";
import { fetchDataAndNotify } from "./src/graphql/graphql.js";

dotenv.config();

async function start() {
  await connectToDatabase();
  startBot();
  while (true) {
    await fetchDataAndNotify();
    await delay(1000); // Delay between fetch operations
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

start();
