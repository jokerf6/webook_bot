import fetch from "node-fetch";
import { contentfulConfig } from "../config/config.js";
import { readTeamsFromDB } from "../database/queries.js";
import { sendMatchNotifications } from "../bot/handlers.js";
import { getTickets } from "../scraper/scraper.js";

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
        buttonLabel
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
    buttonLabel: "Book Tickets",
    OR: [
      { title_contains: "Saudi Super Cup" },
      { title_contains: "AFC Asian Qualifiers" },
      { title_contains: "Roshn Saudi League" },
    ],
  },
  orderEvent: ["order_ASC", "sys_publishedAt_DESC"],
};

export async function fetchDataAndNotify() {
  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${contentfulConfig.accessToken}`,
    },
    body: JSON.stringify({ query: combinedQuery, variables }),
  };

  try {
    const response = await fetch(contentfulConfig.endpoint, payload);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    const teams = await readTeamsFromDB();
    const events = data.data.eventCollection.items;

    for (const team of teams) {
      await sendMatchNotifications(events, team.user);
    }
  } catch (error) {
    console.error("Error fetching data:");
  }
}
