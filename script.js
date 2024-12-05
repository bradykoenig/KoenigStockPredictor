const API_KEY = "ct8h0mpr01qtkv5sb890ct8h0mpr01qtkv5sb89g";
const API_URL_TOP_STOCKS = `https://finnhub.io/api/v1/stock/symbol`;
const API_URL_QUOTE = `https://finnhub.io/api/v1/quote`;
const API_URL_PROFILE = `https://finnhub.io/api/v1/stock/profile2`;

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";
const DAILY_STORAGE_KEY = "topDailyStocks";

// Enhanced criteria for "Top Stocks Today"
function passesStricterCriteria(stock, avgVolume, currentVolume, avg5, avg20) {
  return (
    stock.change > 20 && // Daily change > 20%
    stock.trend === "Upward" && // Positive trend
    stock.peRatio !== null &&
    stock.peRatio < 20 && // P/E Ratio < 20
    currentVolume > avgVolume * 2 && // Volume surge > 100%
    stock.price > avg5 && // Price above 5-day moving average
    stock.price > avg20 // Price above 20-day moving average
  );
}

// Fetch all US stocks and filter the top-performing ones
async function fetchTopStocks() {
  const response = await fetch(`${API_URL_TOP_STOCKS}?exchange=US&token=${API_KEY}`);
  const data = await response.json();
  if (!data || !Array.isArray(data)) throw new Error("Failed to fetch stock symbols.");
  return data.slice(0, 20).map((stock) => stock.symbol); // Limit to 20 stocks per refresh
}

async function fetchStockDetails(symbol) {
    const [quoteResponse, profileResponse] = await Promise.all([
      fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${API_KEY}`),
      fetch(`${API_URL_PROFILE}?symbol=${symbol}&token=${API_KEY}`),
    ]);
  
    const quoteData = await quoteResponse.json();
    const profileData = await profileResponse.json();
  
    if (!quoteData || !profileData)
      throw new Error(`Failed to fetch details for ${symbol}.`);
  
    // Calculate P/E Ratio if not provided
    let peRatio = profileData.pe;
    if (!peRatio && profileData.eps && profileData.eps > 0) {
      peRatio = quoteData.c / profileData.eps; // Price / EPS
    }
  
    return {
      symbol,
      price: quoteData.c,
      change: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
      peRatio: peRatio || "N/A", // Default to N/A if still unavailable
      beta: profileData.beta || "N/A", // Ensure beta is non-null
      dividendYield: profileData.dividendYield || 0, // Ensure dividend yield is non-null
      trend: quoteData.c > quoteData.pc ? "Upward" : "Downward",
    };
  }
  

// Add stocks to leaderboards only if they pass stricter criteria
function addToLeaderboards(stock, dailyStocks, weeklyStocks) {
  if (
    passesStricterCriteria(
      stock,
      stock.avgVolume,
      stock.currentVolume,
      stock.avg5,
      stock.avg20
    )
  ) {
    // Add to "Top Stocks Today"
    if (dailyStocks.length < 5) {
      dailyStocks.push(stock);
    }
    // Add to "Top Stocks Weekly" if not already present
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
    const topStocks = await fetchTopStocks();
    const dailyStocks = loadStocks(DAILY_STORAGE_KEY) || [];
    const weeklyStocks = loadStocks(WEEKLY_STORAGE_KEY) || [];

    for (const symbol of topStocks) {
      try {
        const stockDetails = await fetchStockDetails(symbol);

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stockDetails.symbol}</td>
          <td>${stockDetails.price.toFixed(2)}</td>
          <td>${stockDetails.change.toFixed(2)}%</td>
          <td>${stockDetails.peRatio || "N/A"}</td>
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
        console.error(`Failed to fetch data for ${symbol}:`, error);
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
