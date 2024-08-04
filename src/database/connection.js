import mysql from "mysql2/promise";
import { dbConfig } from "../config/config.js";

let connection;

export async function connectToDatabase() {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to MySQL database...");
  } catch (error) {
    console.error("Error connecting to MySQL database:", error);
    process.exit(1); // Exit the process on connection error
  }
}

export function getConnection() {
  return connection;
}
