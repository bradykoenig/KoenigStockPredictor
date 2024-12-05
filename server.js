const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB Connection
const dbURI = "mongodb+srv://bkoenig122:Tbirds123%21@stockpredictor.26ofh.mongodb.net/?retryWrites=true&w=majority&appName=StockPredictor";
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// Define Leaderboard Schema
const StockSchema = new mongoose.Schema({
  symbol: String,
  reason: String,
  change: Number,
  trend: String,
  dateAdded: { type: Date, default: Date.now },
});

const DailyStock = mongoose.model("DailyStock", StockSchema);
const WeeklyStock = mongoose.model("WeeklyStock", StockSchema);

// API Endpoints

// Get daily stocks
app.get("/api/daily", async (req, res) => {
  const stocks = await DailyStock.find();
  res.json(stocks);
});

// Add daily stocks
app.post("/api/daily", async (req, res) => {
  const newStocks = req.body.stocks;

  // Add new stocks if they don't already exist
  for (const stock of newStocks) {
    const exists = await DailyStock.findOne({ symbol: stock.symbol });
    if (!exists) await DailyStock.create(stock);
  }

  res.json({ message: "Daily stocks updated" });
});

// Clear daily stocks at midnight
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    await DailyStock.deleteMany({});
    console.log("Daily stocks cleared at midnight");
  }
}, 60000); // Check every minute

// Get weekly stocks
app.get("/api/weekly", async (req, res) => {
  const stocks = await WeeklyStock.find();
  res.json(stocks);
});

// Add weekly stocks
app.post("/api/weekly", async (req, res) => {
  const bestStock = req.body.stock;

  // Add stock if it doesn't already exist
  const exists = await WeeklyStock.findOne({ symbol: bestStock.symbol });
  if (!exists) await WeeklyStock.create(bestStock);

  res.json({ message: "Weekly stock updated" });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
