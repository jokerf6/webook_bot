import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fetch from "node-fetch";

dotenv.config();

const endpoint =
  "https://graphql.contentful.com/content/v1/spaces/vy53kjqs34an/environments/master";
const accessToken = "_nOOOX6K1meTmE-2rrZivhrgCZPL8aJDOlaMa8n-K1g";
const token = "7238677470:AAHx6uv5qDRHAYHmvhbuE1CXzCONwMT-nX4";
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
  console.log("Read Now", new Date());
  try {
    const [rows] = await connection.execute(query);

    return rows;
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
  }
}

// Function to send message to Telegram user
async function sendMessage(chatId, message) {
  try {
    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Function to check for matches and send appropriate messages
async function sendMatchNotifications(data, chatId, index) {
  for (let i = 0; i < data.length; i++) {
    await handleMatch(chatId, data[i], index);
  }
}

// Function to handle individual match notification
async function handleMatch(chatId, item, index) {
  const matchId = item.id;
  const query = "SELECT * FROM matches WHERE chatId = ? AND matchId = ?";
  const values = [chatId, matchId];

  try {
    const [rows] = await connection.execute(query, values);
    if (rows.length === 0) {
      if (item.ticketingUrlSlug !== null) {
        if (item.image31 !== null) {
          await bot.sendPhoto(chatId, item.image31.url, {
            caption: `Tickets for ${item.title} are available on the website now \n you can book it from this link https://webook.com/en/events/${item.ticketingUrlSlug}/book`,
          });
        } else {
          await bot.sendPhoto(chatId, item.image11.url, {
            caption: `Tickets for ${item.title} are available on the website now \n you can book it from this link https://webook.com/en/events/${item.ticketingUrlSlug}/book`,
          });
        }
      } else {
        if (item.image31 !== null) {
          await bot.sendPhoto(chatId, item.image31.url, {
            caption: `Tickets for ${item.title} are available on the website now \n Tickets Available at the Zone or from external website`,
          });
        } else {
          await bot.sendPhoto(chatId, item.image11.url, {
            caption: `Tickets for ${item.title} are available on the website now \n you can book it from this link https://webook.com/en/events/${item.ticketingUrlSlug}/book`,
          });
        }
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
  await bot.sendMessage(chatId, "bot is available now");
});

async function fetchDataAndNotify() {
  const combinedQuery = `
  query getCombinedData(
    $lang: String
    $limit: Int
    $skip: Int
    $whereEvent: EventFilter
    $orderEvent: [EventOrder]
    $whereExperience: ExperienceFilter
    $orderExperience: [ExperienceOrder]
    $wherePackage: PackageFilter
    $orderPackage: [PackageOrder]
    $whereShows: ShowsFilter
    $orderShows: [ShowsOrder]
  ) {
    eventCollection(locale: $lang, limit: $limit, skip: $skip, where: $whereEvent, order: $orderEvent) {
      total
      items {
        id
        title
              ticketingUrlSlug
  image31 {
            title
            sys {
              id
            }
            url
         
          }
               image11 {
            title
            sys {
              id
            }
            url
         
          }
       
      }
    }
    experienceCollection(locale: $lang, limit: $limit, skip: $skip, where: $whereExperience, order: $orderExperience) {
      total
         items {
        id
        title
              ticketingUrlSlug
  image31 {
            title
            sys {
              id
            }
            url
         
          }
              image11 {
            title
            sys {
              id
            }
            url
         
          }
       
      }
    }
    packageCollection(locale: $lang, limit: $limit, skip: $skip, where: $wherePackage, order: $orderPackage) {
      total
         items {
        id
        title
              ticketingUrlSlug
  image31 {
            title
            sys {
              id
            }
            url
         
          }
               image11 {
            title
            sys {
              id
            }
            url
         
          }
       
      }
    }
         showsCollection(locale: $lang, limit: $limit, skip: $skip, where: $whereShows, order: $orderShows) {
      total
         items {
        id
        title
              ticketingUrlSlug
  image31 {
            title
            sys {
              id
            }
            url
         
          }
              image11 {
            title
            sys {
              id
            }
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
      visibility_not: "private", // Adjust this filter based on your needs
    },
    orderEvent: ["sys_publishedAt_DESC"], // Adjust ordering as needed
    whereExperience: {
      visibility_not: "private", // Adjust this filter based on your needs
    },
    orderExperience: ["sys_publishedAt_DESC"], // Adjust ordering as needed
    wherePackage: {
      visibility_not: "private", // Adjust this filter based on your needs

      // Adjust this filter based on your needs
    },
    orderPackage: ["sys_publishedAt_DESC"], // Adjust ordering as needed
    whereShows: {
      visibility_not: "private", // Adjust this filter based on your needs

      // Adjust this filter based on your needs
    },
    orderShows: ["sys_publishedAt_DESC"], // Adjust ordering as needed
  };

  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: combinedQuery,
      variables,
    }),
  };

  await fetch(endpoint, payload)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(async (data) => {
      const teams = await readTeamsFromDB();
      const combinedResponse = {
        events: data.data.eventCollection,
        experiences: data.data.experienceCollection,
        packages: data.data.packageCollection,
        shows: data.data.showsCollection,
      };
      const allData = [
        ...combinedResponse.events.items,
        ...combinedResponse.experiences.items,
        ...combinedResponse.packages.items,
        ...combinedResponse.shows.items,
      ];
      for (let i = 0; i < teams.length; i++) {
        await sendMatchNotifications(allData, teams[i].user, i);
      }
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

await connectToDatabase();

async function start() {
  while (true) {
    await fetchDataAndNotify();
    await delay(300000);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

start();
