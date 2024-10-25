import { MongoClient } from "mongodb";

let client;
let db;

export async function connectToDatabase() {
  try {
    client = new MongoClient(
      "mongodb+srv://fahd:fahd@cluster0.gchoxor.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    );
    await client.connect();
    db = client.db("test");
    console.log("Connected to MongoDB database...");
  } catch (error) {
    console.error("Error connecting to MongoDB database:", error);
    process.exit(1); // Exit the process on connection error
  }
}

export function getDb() {
  return db;
}
