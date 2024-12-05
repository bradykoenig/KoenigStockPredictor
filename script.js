const FINNHUB_API_KEY = "ct8h0mpr01qtkv5sb890ct8h0mpr01qtkv5sb89g";
const API_URL_STOCKS = `https://finnhub.io/api/v1/stock/symbol`;
const API_URL_QUOTE = `https://finnhub.io/api/v1/quote`;
const API_URL_FINANCIALS = `https://finnhub.io/api/v1/stock/metric`;

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";
const DAILY_STORAGE_KEY = "topDailyStocks";

// Fetch stock symbols from Finnhub
async function fetchStockSymbols() {
  try {
    const response = await fetch(
      `${API_URL_STOCKS}?exchange=US&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    console.log("Fetched Stock Symbols:", data);
    return data.map((stock) => stock.symbol).slice(0, 50); // Limit to top 50 symbols
  } catch (error) {
    console.error("Error fetching stock symbols:", error);
    return [];
  }
}

// Fetch EPS from Finnhub's financials API
async function fetchEPS(symbol) {
  try {
    const response = await fetch(
      `${API_URL_FINANCIALS}?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();

    console.log(`Financial Data for ${symbol}:`, data);

    if (!data || !data.metric || !data.metric["epsBasicTTM"]) {
      console.warn(`EPS not found for ${symbol}`);
      return null;
    }

    return data.metric["epsBasicTTM"]; // Return EPS (trailing twelve months)
  } catch (error) {
    console.error(`Error fetching EPS for ${symbol}:`, error);
    return null;
  }
}

// Fetch detailed stock data and calculate P/E ratio
async function fetchStockDetails(symbol) {
  try {
    const [quoteResponse, eps] = await Promise.all([
      fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${FINNHUB_API_KEY}`),
      fetchEPS(symbol),
    ]);

    const quoteData = await quoteResponse.json();

    console.log(`Stock Data for ${symbol}:`, { quoteData, eps });

    if (!quoteData) throw new Error(`Missing data for ${symbol}`);

    const price = quoteData.c;
    const peRatio = eps ? (price / eps).toFixed(2) : "N/A"; // Calculate P/E ratio

    // Determine why the stock is performing well
    let performanceReason = "No clear reason";
    if (quoteData.c > quoteData.pc && quoteData.c > price * 1.05) {
      performanceReason = "Positive price momentum";
    } else if (peRatio !== "N/A" && peRatio < 20) {
      performanceReason = "Undervalued based on P/E ratio";
    } else if (eps && eps > 0) {
      performanceReason = "Strong earnings per share (EPS)";
    }

    return {
      symbol,
      price: price ? price.toFixed(2) : "N/A",
      change: price && quoteData.pc
        ? (((price - quoteData.pc) / quoteData.pc) * 100).toFixed(2)
        : "N/A",
      peRatio,
      trend: price > quoteData.pc ? "Upward" : "Downward",
      reason: performanceReason,
    };
  } catch (error) {
    console.error(`Error fetching stock details for ${symbol}:`, error);
    return null; // Return null to skip this stock
  }
}

// Add stocks to leaderboards only if they pass strict criteria
function addToLeaderboards(stock, dailyStocks, weeklyStocks) {
  if (
    stock &&
    stock.peRatio !== "N/A" &&
    stock.peRatio > 0 &&
    stock.peRatio < 25 && // Ensure valid P/E ratio
    stock.change > 2 // Ensure at least 2% daily change
  ) {
    dailyStocks.push(stock);

    if (!weeklyStocks.find((s) => s.symbol === stock.symbol)) {
      weeklyStocks.push(stock);
    }
  }
}

// Save stocks to localStorage
function saveStocks(key, stocks) {
  const now = new Date();
  const data = {
    stocks,
    expiry: new Date(now.setHours(24, 0, 0, 0)), // Expire at midnight
  };
  localStorage.setItem(key, JSON.stringify(data));
}

// Load stocks from localStorage
function loadStocks(key) {
  const data = JSON.parse(localStorage.getItem(key));
  if (!data || new Date() > new Date(data.expiry)) return null; // Expired or no data
  return data.stocks;
}

// Update the "Top Stocks Today" section
function updateDailyStocksSection(dailyStocks) {
  const dailyStocksList = document.getElementById("dailyStocks");
  dailyStocksList.innerHTML = ""; // Clear previous list

  if (!dailyStocks || dailyStocks.length === 0) {
    dailyStocksList.innerHTML = "<li>No top stocks today</li>";
    return;
  }

  dailyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong>${stock.symbol}</strong>: ${stock.change}% (${stock.trend})
    `;
    dailyStocksList.appendChild(listItem);
  });
}

// Update the "Top Stocks Weekly" section
function updateWeeklyStocksSection(weeklyStocks) {
  const weeklyStocksList = document.getElementById("weeklyStocks");
  weeklyStocksList.innerHTML = ""; // Clear previous list

  if (!weeklyStocks || weeklyStocks.length === 0) {
    weeklyStocksList.innerHTML = "<li>No top stocks this week</li>";
    return;
  }

  weeklyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong>${stock.symbol}</strong>: ${stock.change}% (${stock.trend})
    `;
    weeklyStocksList.appendChild(listItem);
  });
}

// Update the stock table and leaderboards dynamically
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = ""; // Clear previous data

  try {
    const stockSymbols = await fetchStockSymbols(); // Fetch dynamic stock symbols
    const dailyStocks = loadStocks(DAILY_STORAGE_KEY) || [];
    const weeklyStocks = loadStocks(WEEKLY_STORAGE_KEY) || [];

    for (const symbol of stockSymbols) {
      try {
        const stockDetails = await fetchStockDetails(symbol);

        if (!stockDetails) continue; // Skip invalid stocks

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stockDetails.symbol}</td>
          <td>${stockDetails.price}</td>
          <td>${stockDetails.change}%</td>
          <td>${stockDetails.peRatio}</td>
          <td>${stockDetails.trend}</td>
          <td>${stockDetails.reason}</td>
        `;
        tbody.appendChild(row);

        // Add to leaderboards based on strict criteria
        addToLeaderboards(stockDetails, dailyStocks, weeklyStocks);
      } catch (error) {
        console.error(`Error processing stock ${symbol}:`, error);
      }
    }

    // Save and update daily and weekly stocks
    saveStocks(DAILY_STORAGE_KEY, dailyStocks);
    saveStocks(WEEKLY_STORAGE_KEY, weeklyStocks);
    updateDailyStocksSection(dailyStocks);
    updateWeeklyStocksSection(weeklyStocks);
  } catch (error) {
    console.error("Error updating stock table:", error);
  }
}

// Refresh every 5 minutes
setInterval(updateStockTable, 300000); // 5 minutes
updateStockTable();
