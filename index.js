import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fetch from "node-fetch";
import puppeteer from "puppeteer";
import { createCanvas, loadImage } from "canvas";
import async from "async";

dotenv.config();

const endpoint =
  "https://graphql.contentful.com/content/v1/spaces/vy53kjqs34an/environments/master";

const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// MySQL database connection configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let connection;
async function connectToDatabase() {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to MySQL database...");
  } catch (error) {
    console.error("Error connecting to MySQL database:", error);
    process.exit(1); // Exit the process on connection error
  }
}

async function insertTeam(chatId) {
  const query = "INSERT INTO users (user) VALUES (?)";
  const values = [chatId];
  try {
    await connection.execute(query, values);
  } catch (error) {
    console.error("Error inserting team into MySQL:", error);
  }
}

async function insertMatch(chatId, matchId) {
  const query = "INSERT INTO matches (chatId, matchId) VALUES (?, ?)";
  const values = [chatId, matchId];
  try {
    await connection.execute(query, values);
    console.log(`Inserted match with chatId ${chatId} and matchId ${matchId}`);
  } catch (error) {
    console.error("Error inserting data into MySQL:", error);
  }
}

// Function to read teams from the database
async function readTeamsFromDB() {
  const query = "SELECT * FROM users";
  try {
    const [rows] = await connection.execute(query);
    return rows;
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
    return [];
  }
}

// Function to send a message to a Telegram user
async function sendMessage(chatId, message) {
  try {
    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

const getTeamsInlineKeyboard = (allTeams) => ({
  reply_markup: {
    inline_keyboard: allTeams.map((team) => [
      {
        text: team.name,
        callback_data: JSON.stringify({ idx: team.idx, id: team.id }), // Encode as JSON string
      },
    ]),
  },
});

// Function to check for matches and send appropriate messages
async function sendMatchNotifications(data, chatId) {
  for (const item of data) {
    await handleMatch(chatId, item);
  }
}

// Function to handle individual match notification
async function handleMatch(chatId, item) {
  const matchId = item.id;
  const query = "SELECT * FROM matches WHERE chatId = ? AND matchId = ?";
  const values = [chatId, matchId];

  try {
    const [rows] = await connection.execute(query, values);
    if (rows.length === 0) {
      const teams = await TeamsOfMatch(item.ticketingUrlSlug);
      const imageUrl = item.image31?.url || item.image11?.url;
      if (imageUrl) {
        await bot.sendPhoto(chatId, imageUrl, {
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

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  await insertTeam(chatId);
  await sendMessage(chatId, "Bot is available now");
});

async function fetchDataAndNotify() {
  const combinedQuery = `
    query getCombinedData(
      $lang: String
      $limit: Int
      $skip: Int
      $whereEvent: EventFilter
      $orderEvent: [EventOrder]
    ) {
      eventCollection(locale: $lang, limit: $limit, skip: $skip, where: $whereEvent, order: $orderEvent) {
        total
        items {
          id
          title
          ticketingUrlSlug
          image31 {
            url
          }
          image11 {
            url
          }
        }
      }
    }
  `;

  const variables = {
    lang: "en-US",
    limit: 500,
    skip: 0,
    whereEvent: {
      visibility_not: "private",
      AND: [
        {
          OR: [
            { title_contains: "Football" },
            { description_contains: "Football" },
            { category: { title_contains: "Football" } },
            { location: { title_contains: "Football" } },
            { zone: { title_contains: "Football" } },
            {
              seo: {
                OR: [
                  { title_contains: "Football" },
                  { keywords_contains: "Football" },
                  { description_contains: "Football" },
                ],
              },
            },
          ],
        },
        { ticketingUrlSlug_contains: "vs" },
      ],
    },
    orderEvent: ["order_ASC", "sys_publishedAt_DESC"],
  };

  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: combinedQuery, variables }),
  };

  try {
    const response = await fetch(endpoint, payload);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    const teams = await readTeamsFromDB();
    const events = data.data.eventCollection.items;

    for (const team of teams) {
      await sendMatchNotifications(events, team.user);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

const scrapeQueue = async.queue(async (task, callback) => {
  try {
    const { chatId, parsedData } = task;
    const selectedTeam = parsedData.idx;
    const link = await scrape(parsedData.id, selectedTeam);
    await sendMessage(
      chatId,
      `Please put your payment card to complete buying your ticket ${link}.`
    );
  } catch (error) {
    console.error("Error during scrape:", error);
    await sendMessage(
      task.chatId,
      "There was an error processing your request. Please try again later."
    );
  } finally {
    await callback();
  }
}, 1);
const debounceTime = 10000; // 10 seconds
const lastProcessed = new Map();
bot.on("callback_query", async (callbackQuery) => {
  // console.log(callbackQuery);
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
    // Process the callback query
    scrapeQueue.push({ chatId, parsedData });
  } catch (error) {
    console.error("Error processing callback query:", error);
  }
});

async function start() {
  await connectToDatabase();
  while (true) {
    await fetchDataAndNotify();
    await delay(100000); // Delay between fetch operations
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

start();

async function TeamsOfMatch(id) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1200 });

  try {
    await page.goto(`https://webook.com/en/events/${id}/book`);
    await page.waitForSelector("button.bg-primary", { timeout: 10000 });
    await page.click("button.bg-primary");
    await page.waitForSelector('input[name="email"]');

    await page.type('input[name="email"]', process.env.EMAIL);
    await page.type('input[name="password"]', process.env.PASSWORD);
    await page.click("#email-login-button");

    await page.waitForSelector('button[name="favorite_team"]');
    const buttons = await page.$$('button[name="favorite_team"]');
    const teams = [];

    for (let i = 0; i < buttons.length; i++) {
      const buttonText = await buttons[i].evaluate((node) => node.innerText);
      teams.push({ id, idx: i, name: buttonText });
    }

    return teams;
  } catch (error) {
    console.error("Error in TeamsOfMatch:", error);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrape(id, team) {
  // console.log("hi", team);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1200 });

  try {
    await page.goto(`https://webook.com/en/events/${id}/book`);
    await page.waitForSelector("button.bg-primary", { timeout: 10000 });
    await page.click("button.bg-primary");
    await page.waitForSelector('input[name="email"]');

    await page.type('input[name="email"]', process.env.EMAIL);
    await page.type('input[name="password"]', process.env.PASSWORD);
    await page.click("#email-login-button");

    await page.waitForSelector('button[name="favorite_team"]');
    const buttons = await page.$$('button[name="favorite_team"]');

    const buttonSelector = `button[name="favorite_team"]:nth-of-type(${
      team + 1
    })`;
    const targetButton = await page.$(buttonSelector);

    const ariaChecked = await targetButton.evaluate((button) =>
      button.getAttribute("aria-checked")
    );

    if (ariaChecked === "false") {
      await page.click(buttonSelector);
    }

    await page.click('input[name="team_terms"]');
    await page.click('button[type="submit"]');
    await page.waitForSelector("#booking-section-ref iframe", {
      timeout: 10000,
    });
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await page.screenshot({ path: "screenshot.png", fullPage: true });
    const targetColor = "#04965e";
    let coordinates = await findColorPixel("screenshot.png", targetColor);

    if (coordinates) {
      await page.mouse.click(coordinates.x, coordinates.y);
    }

    await page.screenshot({ path: "screenshot.png", fullPage: true });
    coordinates = await findColorPixel("screenshot.png", targetColor);

    if (coordinates) {
      await page.mouse.click(coordinates.x, coordinates.y);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await page.waitForSelector("#booking-section-ref iframe", {
      timeout: 10000,
    });
    const iframeElement = await page.$("#booking-section-ref iframe");
    const iframe = await iframeElement.contentFrame();

    await iframe.waitForSelector("body");
    await iframe.waitForSelector(
      "button.circleButton.plus.icon-plus.highlighted"
    );
    await iframe.click("button.circleButton.plus.icon-plus.highlighted");

    await iframe.waitForSelector("div.button .caption");
    await iframe.click("div.button .caption");
    await page.waitForSelector('input[type="checkbox"].bg-body');

    const checkboxes = await page.$$('input[type="checkbox"].bg-body');
    for (let i = 0; i < 2; i++) {
      await checkboxes[i].click();
    }

    await page.waitForSelector("#proceed-to-payment");
    await page.click("#proceed-to-payment");
    await page.waitForSelector(".pt_container"); // Replace with a specific selector from your page

    return page.url();
  } catch (error) {
    console.error("Error during scrape:", error);
    return null;
  } finally {
    await browser.close();
  }
}

async function findColorPixel(imagePath, targetColor) {
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const { r: targetR, g: targetG, b: targetB } = hexToRgb(targetColor);
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, image.width, image.height);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  const tolerance = 10;

  const isColorMatch = (r, g, b) =>
    Math.abs(r - targetR) <= tolerance &&
    Math.abs(g - targetG) <= tolerance &&
    Math.abs(b - targetB) <= tolerance;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const x = (i / 4) % image.width;
    const y = Math.floor(i / 4 / image.width);

    if (isColorMatch(r, g, b)) {
      return { x, y };
    }
  }

  return null;
}
