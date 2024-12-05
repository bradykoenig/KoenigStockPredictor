const API_KEY = "ct8h0mpr01qtkv5sb890ct8h0mpr01qtkv5sb89g";
const API_URL_TOP_STOCKS = `https://finnhub.io/api/v1/stock/symbol`;
const API_URL_QUOTE = `https://finnhub.io/api/v1/quote`;

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";

// Fetch top-performing stocks (limit to 20)
async function fetchTopStocks() {
  try {
    const response = await fetch(`${API_URL_TOP_STOCKS}?exchange=US&token=${API_KEY}`);
    const data = await response.json();
    if (!data || !Array.isArray(data)) throw new Error("Failed to fetch stock symbols.");

    return data.slice(0, 20).map((stock) => stock.symbol);
  } catch (error) {
    console.error("Error fetching top stocks:", error);
    return [];
  }
}

// Fetch detailed stock data
async function fetchStockDetails(symbol) {
  try {
    const response = await fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${API_KEY}`);
    const quoteData = await response.json();

    if (!quoteData || !quoteData.c) return null;

    const trend = quoteData.c > quoteData.pc ? "Upward" : "Downward";
    const change = ((quoteData.c - quoteData.pc) / quoteData.pc) * 100;

    return {
      symbol,
      price: quoteData.c,
      change: change.toFixed(2),
      trend: trend,
      reason: getPerformanceReason(change, trend),
    };
  } catch (error) {
    console.error(`Failed to fetch details for ${symbol}:`, error);
    return null;
  }
}

// Determine why the stock is performing well
function getPerformanceReason(change, trend) {
  const reasons = [];
  if (trend === "Upward") reasons.push("Positive price momentum");
  if (change > 5) reasons.push("Strong recent gains");
  return reasons.join(", ") || "No specific reason identified";
}

// Find the best stock
function findBestStock(stocks) {
  return stocks.reduce((best, current) => (!best || current.change > best.change ? current : best), null);
}

// Save and load Today Leaderboard
function saveDailyPicks(stock) {
  localStorage.setItem("topDailyStock", JSON.stringify(stock));
}

function loadDailyPicks() {
  return JSON.parse(localStorage.getItem("topDailyStock")) || null;
}

// Save and load Weekly Leaderboard
function saveWeeklyPicks(stocks) {
  const now = new Date();
  const data = {
    stocks,
    expiry: new Date(now.setDate(now.getDate() + (7 - now.getDay()))), // Expire end of week
  };
  localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(data));
}

function loadWeeklyPicks() {
  const data = JSON.parse(localStorage.getItem(WEEKLY_STORAGE_KEY));
  if (!data || new Date() > new Date(data.expiry)) return [];
  return data.stocks;
}

// Update Weekly Leaderboard
function updateWeeklyStocksSection(weeklyStocks) {
  const weeklyStocksList = document.getElementById("weeklyStocks");
  weeklyStocksList.innerHTML = ""; // Clear previous list

  if (!weeklyStocks.length) {
    weeklyStocksList.innerHTML = "<li>No top stocks this week</li>";
    return;
  }

  weeklyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `<strong>${stock.symbol}</strong>: ${stock.reason} (${stock.change}%)`;
    weeklyStocksList.appendChild(listItem);
  });
}

// Update Today Leaderboard
function updateDailyStocksSection(bestStock) {
  const dailyStocksList = document.getElementById("dailyStocks");
  dailyStocksList.innerHTML = ""; // Clear previous list

  if (!bestStock) bestStock = loadDailyPicks();

  if (!bestStock) {
    dailyStocksList.innerHTML = "<li>No top stock today</li>";
    return;
  }

  const listItem = document.createElement("li");
  listItem.innerHTML = `<strong>${bestStock.symbol}</strong>: ${bestStock.reason} (${bestStock.change}%)`;
  dailyStocksList.appendChild(listItem);

  saveDailyPicks(bestStock);
}

// Update stock table and leaderboards
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = ""; // Clear previous data

  try {
    const topStocks = await fetchTopStocks();
    const weeklyStocks = loadWeeklyPicks();
    const stockDetailsList = [];

    for (const symbol of topStocks) {
      const stockDetails = await fetchStockDetails(symbol);
      if (!stockDetails || stockDetails.trend === "Downward") continue;

      stockDetailsList.push(stockDetails);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${stockDetails.symbol}</td>
        <td>${stockDetails.price}</td>
        <td>${stockDetails.change}%</td>
        <td>${stockDetails.trend}</td>
        <td>${stockDetails.reason}</td>
      `;
      tbody.appendChild(row);
    }

    const bestStock = findBestStock(stockDetailsList);
    updateDailyStocksSection(bestStock);
    if (bestStock && !weeklyStocks.find((s) => s.symbol === bestStock.symbol)) {
      weeklyStocks.push(bestStock);
      saveWeeklyPicks(weeklyStocks);
      updateWeeklyStocksSection(weeklyStocks);
    }
  } catch (error) {
    console.error("Error updating stock table:", error);
  }
}

// Refresh every 3 minutes
setInterval(updateStockTable, 180000);
updateStockTable();
