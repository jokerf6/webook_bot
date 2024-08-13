import { sendMessage, sendMessageOption, sendPhoto } from "./bot.js";
import async from "async";

import {
  insertTeam,
  insertMatch,
  readTeamsFromDB,
  readChatData,
  CheckMatches,
  DeleteUser,
} from "../database/queries.js";
import {
  loginAndCheckSuccess,
  scrape,
  TeamsOfMatch,
} from "../scraper/scraper.js";

const userStates = {};

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start") {
    await DeleteUser(chatId);
    userStates[chatId] = { step: "email" };
    await sendMessage(chatId, "Please reply with your Webook Email");
  } else if (userStates[chatId] && userStates[chatId].step === "email") {
    if (isValidEmail(text)) {
      userStates[chatId].email = text;
      userStates[chatId].step = "password";
      await sendMessage(chatId, "Please reply with your Webook Password");
    } else {
      await sendMessage(
        chatId,
        "Invalid email address. Please enter a valid Webook Email."
      );
    }
  } else if (userStates[chatId] && userStates[chatId].step === "password") {
    userStates[chatId].password = text;
    await sendMessage(chatId, "Wait, we are trying to log you in now.");
    const success = await loginAndCheckSuccess(
      userStates[chatId].email,
      userStates[chatId].password
    );

    if (success) {
      await insertTeam(
        chatId,
        userStates[chatId].email,
        userStates[chatId].password
      );
      await sendMessage(
        chatId,
        `Thank you! You have provided the following details:\nEmail: ${userStates[chatId].email}\nPassword: ${userStates[chatId].password}`
      );
      userStates[chatId].step = "afterLogin";
      await sendMessageOption(
        chatId,
        "Would you like to add another account or finish?",
        {
          reply_markup: JSON.stringify({
            keyboard: [["Add Another Account"], ["Finish"]],
            one_time_keyboard: true,
            resize_keyboard: true,
          }),
        }
      );
    } else {
      await sendMessage(chatId, "Login failed. Please try again.");
      userStates[chatId] = { step: "email" };
      await sendMessage(chatId, "Please reply with your Webook Email");
    }
  } else if (userStates[chatId] && userStates[chatId].step === "afterLogin") {
    if (text === "Add Another Account") {
      userStates[chatId] = { step: "email" };
      await sendMessage(chatId, "Please reply with your Webook Email");
    } else if (text === "Finish") {
      await sendMessage(chatId, "Thank you! You have finished the process.");
      delete userStates[chatId];
    } else {
      await sendMessage(
        chatId,
        "Please choose a valid option: Add Another Account or Finish."
      );
    }
  }
}
const scrapeQueue = async.queue(async (task, callback) => {
  try {
    const { chatId, parsedData } = task;
    const selectedTeam = parsedData.idx;
    const user = await readChatData(chatId);
    for (let i = 0; i < user.length; i += 1) {
      const success = await scrape(
        parsedData.id,
        selectedTeam,
        user[i].email,
        user[i].password,
        "",
        chatId
      );
      if (success) {
        await sendMessage(
          chatId,
          `We have reserved ${success.numOfTickets} tickets for you ${parsedData.name} team in Block ${success.block}\nTo complete your purchase, please follow this link: ${success.url}`
        );
      }
    }
  } catch (error) {
    console.error("Error during scrape:", error);
    await sendMessage(
      task.chatId,
      "There was an error processing your request. Please try again later."
    );
  } finally {
    await callback();
  }
}, 5);
const debounceTime = 10000; // 10 seconds
const lastProcessed = new Map();
export async function handleCallbackQuery(callbackQuery) {
  const callbackId = callbackQuery.id;
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;
  const parsedData = JSON.parse(action);

  // Get the current time
  const now = Date.now();
  const lastTime = lastProcessed.get(callbackId) || 0;

  // If the last processing time is within the debounce time, ignore this query
  if (now - lastTime < debounceTime) {
    console.log(
      `Callback query ${callbackId} is being ignored to prevent multiple triggers.`
    );
    return;
  }

  // Update the last processing time
  lastProcessed.set(callbackId, now);

  try {
    sendMessage(chatId, "Ticket is Booking Now");
    scrapeQueue.push({ chatId, parsedData });
  } catch (error) {
    console.error("Error processing callback query:", error);
  }
}

export async function sendMatchNotifications(events, chatId, email, password) {
  for (const event of events) {
    await handleMatch(chatId, event);
  }
}

const getTeamsInlineKeyboard = (allTeams, photo) => ({
  reply_markup: {
    inline_keyboard: allTeams.map((team) => [
      {
        text: team.name,
        callback_data: JSON.stringify({
          idx: team.idx,
          id: team.id,
          name: team.name,
        }), // Encode as JSON string
      },
    ]),
  },
});

// Function to handle individual match notification
async function handleMatch(chatId, item) {
  const matchId = item.id;

  try {
    const matchStatus = await CheckMatches(chatId, matchId);
    if (matchStatus.length === 0) {
      const teams = await TeamsOfMatch(item.ticketingUrlSlug);
      const imageUrl = item.image31?.url || item.image11?.url;
      if (imageUrl) {
        await sendPhoto(chatId, imageUrl, {
          caption: `Tickets for ${item.title} are available on the website now. Please reply with your favorite team.`,
          ...getTeamsInlineKeyboard(teams),
        });
      }
      await insertMatch(chatId, matchId);
    }
  } catch (error) {
    console.error("Error handling match:", error);
  }
}

// bot.on("message", async (msg) => {
//   const chatId = msg.chat.id;
//   await insertTeam(chatId);
//   await sendMessage(chatId, "Bot is available now");
// });
