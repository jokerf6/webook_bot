import { getConnection } from "./connection.js";

const checkUserExists = async (chatId) => {
  const connection = getConnection();

  const [rows] = await connection.execute(
    "SELECT 1 FROM users WHERE user = ?",
    [chatId]
  );
  return rows.length > 0;
};

export async function insertTeam(chatId, email, password) {
  if (await checkUserExists(chatId)) {
    console.log(`User with chatId ${chatId} already exists.`);
    return;
  }
  const query = "INSERT INTO users (user, email, password) VALUES (?, ?, ?)";
  const values = [chatId, email, password];
  try {
    const connection = getConnection();
    await connection.execute(query, values);
  } catch (error) {
    console.error("Error inserting team into MySQL:", error);
  }
}

export async function insertMatch(chatId, matchId) {
  const query = "INSERT INTO matches (chatId, matchId) VALUES (?, ?)";
  const values = [chatId, matchId];
  try {
    const connection = getConnection();
    await connection.execute(query, values);
    console.log(`Inserted match with chatId ${chatId} and matchId ${matchId}`);
  } catch (error) {
    console.error("Error inserting data into MySQL:", error);
  }
}

export async function readTeamsFromDB() {
  const query = "SELECT * FROM users";
  try {
    const connection = getConnection();
    const [rows] = await connection.execute(query);
    return rows;
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
    return [];
  }
}
export async function readChatData(chatId) {
  const query = "SELECT * FROM users WHERE user = ?";
  const values = [chatId];

  try {
    const connection = getConnection();
    const [rows] = await connection.execute(query, values);
    return rows;
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
    return [];
  }
}
export async function CheckMatches(chatId, matchId) {
  const query = "SELECT * FROM matches WHERE chatId = ? AND matchId = ?";
  const values = [chatId, matchId];
  try {
    const connection = getConnection();
    const [rows] = await connection.execute(query, values);
    return rows;
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
    return [];
  }
}

export async function DeleteUser(chatId) {
  const query = "DELETE FROM users WHERE user = ?";
  const values = [chatId];

  try {
    const connection = getConnection();
    await connection.execute(query, values);
    await DeleteMatches(chatId);
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
  }
}
export async function DeleteMatches(chatId) {
  const query = "DELETE FROM matches WHERE chatId = ?";
  const values = [chatId];

  try {
    const connection = getConnection();
    await connection.execute(query, values);
  } catch (error) {
    console.error("Error reading teams from MySQL:", error);
  }
}
