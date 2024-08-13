import TelegramBot from "node-telegram-bot-api";
import { telegramConfig } from "../config/config.js";
import { handleMessage, handleCallbackQuery } from "./handlers.js";

const bot = new TelegramBot(telegramConfig.token, { polling: true });

export function startBot() {
  bot.on("message", handleMessage);
  bot.on("callback_query", handleCallbackQuery);
}

export async function sendMessage(chatId, message) {
  return bot.sendMessage(chatId, message);
}

export async function sendPhoto(chatId, photo, options) {
  return bot.sendPhoto(chatId, photo, options);
}
