// Assume we have a MongoDB connection and models set up
import { User, Match, Number } from "./models.js";
import { connectToDatabase, getDb } from "./connection.js";

// ... existing code ...

export async function insertTeam(chatId, number) {
  try {
    const db = await getDb();
    await db.collection("users").insertOne({ user: chatId, number });
  } catch (error) {
    console.error("Error inserting team into MongoDB:", error);
  }
}

export async function insertMatch(chatId, matchId) {
  try {
    const db = await getDb();
    await db.collection("matches").insertOne({ chatId, matchId });
    console.log(`Inserted match with chatId ${chatId} and matchId ${matchId}`);
  } catch (error) {
    console.error("Error inserting data into MongoDB:", error);
  }
}
export async function readTeamsFromDB() {
  try {
    // Add a timeout option of 30 seconds (30000 ms)
    const db = await getDb();
    const teams = await await db.collection("users").find({}).toArray();
    return teams;
  } catch (error) {
    if (
      error.name === "MongooseError" &&
      error.message.includes("buffering timed out")
    ) {
      console.error(
        "MongoDB operation timed out. Please check your database connection."
      );
    } else {
      console.error("Error reading teams from MongoDB:", error);
    }
    return [];
  }
}

export async function readChatData(chatId) {
  try {
    const db = await getDb();
    const teams = await db.collection("users").find({ user: chatId }).toArray();
    return teams;
  } catch (error) {
    console.error("Error reading teams from MongoDB:", error);
    return [];
  }
}

export async function checkNumber(number) {
  try {
    const db = await getDb();
    const result = await db.collection("numbers").find({ number }).toArray();
    return result.length > 0 ? true : false;
  } catch (error) {
    console.error("Error reading teams from MongoDB:", error);
    return false;
  }
}

export async function CheckMatches(chatId, matchId) {
  try {
    const db = await getDb();
    const result = await db
      .collection("matches")
      .find({ chatId, matchId })
      .toArray();
    return result;
  } catch (error) {
    console.error("Error reading teams from MongoDB:", error);
    return [];
  }
}

export async function DeleteUser(chatId) {
  try {
    const db = await getDb();
    await db.collection("users").deleteOne({ user: chatId });
    await DeleteMatches(chatId);
  } catch (error) {
    console.error("Error deleting user from MongoDB:", error);
  }
}

export async function DeleteMatches(chatId) {
  try {
    const db = await getDb();
    await db.collection("matches").deleteMany({ chatId });
  } catch (error) {
    console.error("Error deleting matches from MongoDB:", error);
  }
}

export async function Check() {
  const teams = await readTeamsFromDB();
  const matches = await readMatchesFromDB();
}
