import dotenv from "dotenv";

dotenv.config();

export const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

export const telegramConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN,
};

export const contentfulConfig = {
  endpoint:
    "https://graphql.contentful.com/content/v1/spaces/vy53kjqs34an/environments/master",
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
};
