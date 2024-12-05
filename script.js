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
    console.log(`Fetching details for ${symbol}...`);
    const response = await fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${API_KEY}`);
    const quoteData = await response.json();
    console.log(`Quote Data for ${symbol}:`, quoteData);

    if (!quoteData || !quoteData.c) {
      console.error(`Data missing for ${symbol}`);
      return null;
    }

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
  return reasons.length > 0 ? reasons.join(", ") : "No specific reason identified";
}

// Persist weekly picks
function saveWeeklyPicks(stocks) {
  const now = new Date();
  const data = {
    stocks,
    expiry: new Date(now.setDate(now.getDate() + (7 - now.getDay()))),
  };
  localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(data));
}

// Load weekly picks
function loadWeeklyPicks() {
  const data = JSON.parse(localStorage.getItem(WEEKLY_STORAGE_KEY));
  if (!data || new Date() > new Date(data.expiry)) return null;
  return data.stocks;
}

// Add stock to weekly picks
function addStockToWeeklyPicks(stock, weeklyStocks) {
  if (stock.trend === "Upward" && stock.change > 5) {
    weeklyStocks.push(stock);
  }
}

// Add stock to daily picks
function addStockToDailyPicks(stock, dailyStocks) {
  if (stock.trend === "Upward" && stock.change > 5) {
    dailyStocks.push(stock);
  }
}

// Update stock table
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = "";

  try {
    const topStocks = await fetchTopStocks();
    const dailyStocks = [];
    const weeklyStocks = loadWeeklyPicks() || [];

    for (const symbol of topStocks) {
      try {
        const stockDetails = await fetchStockDetails(symbol);

        if (!stockDetails || stockDetails.trend === "Downward") continue;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stockDetails.symbol}</td>
          <td>${stockDetails.price}</td>
          <td>${stockDetails.change}%</td>
          <td>${stockDetails.trend}</td>
          <td>${stockDetails.reason}</td>
        `;
        tbody.appendChild(row);

        addStockToDailyPicks(stockDetails, dailyStocks);
        addStockToWeeklyPicks(stockDetails, weeklyStocks);
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
      }
    }

    saveWeeklyPicks(weeklyStocks);
    updateDailyStocksSection(dailyStocks);
    updateWeeklyStocksSection(weeklyStocks);
  } catch (error) {
    console.error("Error updating stock table:", error);
  }
}

// Update daily picks
function updateDailyStocksSection(dailyStocks) {
  const dailyStocksList = document.getElementById("dailyStocks");
  dailyStocksList.innerHTML = "";

  if (!dailyStocks || dailyStocks.length === 0) {
    dailyStocksList.innerHTML = "<li>No top stocks today</li>";
    return;
  }

  dailyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong>${stock.symbol}</strong>: ${stock.reason}
    `;
    dailyStocksList.appendChild(listItem);
  });
}

// Update weekly picks
function updateWeeklyStocksSection(weeklyStocks) {
  const weeklyStocksList = document.getElementById("weeklyStocks");
  weeklyStocksList.innerHTML = "";

  if (!weeklyStocks || weeklyStocks.length === 0) {
    weeklyStocksList.innerHTML = "<li>No top stocks this week</li>";
    return;
  }

  weeklyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong>${stock.symbol}</strong>: ${stock.reason}
    `;
    weeklyStocksList.appendChild(listItem);
  });
}

// Refresh the table every 3 minutes
setInterval(updateStockTable, 180000);
updateStockTable();
