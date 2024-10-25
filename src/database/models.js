import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    unique: true,
  },
  number: {
    type: String,
    required: true,
  },
});

const matchSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
  },
  matchId: {
    type: String,
    required: true,
  },
});

const numberSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true,
  },
});

export const User = mongoose.model("User", userSchema);
export const Match = mongoose.model("Match", matchSchema);
export const Number = mongoose.model("Number", numberSchema);
