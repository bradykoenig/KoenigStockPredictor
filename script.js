const FINNHUB_API_KEY = "YOUR_FINNHUB_API_KEY"; // Replace with your Finnhub API key
const API_URL_QUOTE = `https://finnhub.io/api/v1/quote`;
const API_URL_PROFILE = `https://finnhub.io/api/v1/stock/profile2`;
const YAHOO_FINANCE_API_URL = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=`;

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";
const DAILY_STORAGE_KEY = "topDailyStocks";

// Fetch P/E ratio from Yahoo Finance
async function fetchPERatioYahoo(symbol) {
  try {
    const response = await fetch(`${YAHOO_FINANCE_API_URL}${symbol}`);
    const data = await response.json();

    console.log(`Yahoo Finance Data for ${symbol}:`, data);

    if (
      !data ||
      !data.quoteResponse ||
      !data.quoteResponse.result ||
      data.quoteResponse.result.length === 0
    ) {
      console.warn(`P/E ratio not found for ${symbol}`);
      return null;
    }

    return data.quoteResponse.result[0].trailingPE || null; // Return trailing P/E ratio if available
  } catch (error) {
    console.error(`Error fetching P/E ratio for ${symbol}:`, error);
    return null;
  }
}

// Fetch detailed stock data
async function fetchStockDetails(symbol) {
  try {
    const [quoteResponse, profileResponse] = await Promise.all([
      fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${FINNHUB_API_KEY}`),
      fetch(`${API_URL_PROFILE}?symbol=${symbol}&token=${FINNHUB_API_KEY}`),
    ]);

    const quoteData = await quoteResponse.json();
    const profileData = await profileResponse.json();

    console.log(`Finnhub Data for ${symbol}:`, { quoteData, profileData });

    if (!quoteData || !profileData) throw new Error(`Missing data for ${symbol}`);

    // Fetch P/E ratio using Yahoo Finance if Finnhub doesn't provide it
    let peRatio = profileData.pe;
    if (!peRatio) {
      peRatio = await fetchPERatioYahoo(symbol);
    }

    return {
      symbol,
      price: quoteData.c,
      change: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
      peRatio: peRatio || "N/A", // Use fetched P/E ratio or default to N/A
      beta: profileData.beta || "N/A", // Fetch beta for risk assessment
      dividendYield: profileData.dividendYield || 0, // Ensure dividend yield is non-null
      trend: quoteData.c > quoteData.pc ? "Upward" : "Downward",
    };
  } catch (error) {
    console.error(`Error fetching stock details for ${symbol}:`, error);
    return null; // Return null to skip this stock
  }
}

// Add stocks to leaderboards only if they pass strict criteria
function addToLeaderboards(stock, dailyStocks, weeklyStocks) {
  if (stock && stock.peRatio !== "N/A") {
    // Example criteria: ensure P/E ratio is valid
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

  dailyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong>${stock.symbol}</strong>: ${stock.change.toFixed(2)}% (${stock.trend})
    `;
    dailyStocksList.appendChild(listItem);
  });
}

// Update the "Top Stocks Weekly" section
function updateWeeklyStocksSection(weeklyStocks) {
  const weeklyStocksList = document.getElementById("weeklyStocks");
  weeklyStocksList.innerHTML = ""; // Clear previous list

  weeklyStocks.forEach((stock) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong>${stock.symbol}</strong>: ${stock.change.toFixed(2)}% (${stock.trend})
    `;
    weeklyStocksList.appendChild(listItem);
  });
}

// Update the stock table and leaderboards dynamically
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = ""; // Clear previous data

  try {
    const topStocks = ["AAPL", "MSFT", "GOOGL"]; // Replace with your top stock symbols
    const dailyStocks = loadStocks(DAILY_STORAGE_KEY) || [];
    const weeklyStocks = loadStocks(WEEKLY_STORAGE_KEY) || [];

    for (const symbol of topStocks) {
      try {
        const stockDetails = await fetchStockDetails(symbol);

        if (!stockDetails) continue; // Skip invalid stocks

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stockDetails.symbol}</td>
          <td>${stockDetails.price.toFixed(2)}</td>
          <td>${stockDetails.change.toFixed(2)}%</td>
          <td>${stockDetails.peRatio}</td>
          <td>${stockDetails.trend}</td>
          <td>${
            stockDetails.trend === "Upward"
              ? "Positive momentum"
              : "No clear reason"
          }</td>
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
