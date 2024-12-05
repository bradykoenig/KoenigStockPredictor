const API_KEY = "luw7HWPbHQT2w67qBRRdpQv57EiHKedK";
const API_URL_TOP_STOCKS = `https://financialmodelingprep.com/api/v3/stock-screener`;
const API_URL_PROFILE = `https://financialmodelingprep.com/api/v3/profile`;

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";

// Fetch top-performing stocks (first 20)
async function fetchTopStocks() {
  try {
    const response = await fetch(`${API_URL_TOP_STOCKS}?marketCapMoreThan=1000000000&limit=20&apikey=${API_KEY}`);
    const data = await response.json();
    if (!data || !Array.isArray(data)) throw new Error("Failed to fetch stock symbols.");

    return data.slice(0, 20).map((stock) => stock.symbol);
  } catch (error) {
    console.error("Error fetching top stocks:", error);
    return [];
  }
}

// Fetch stock details, including P/E ratio
async function fetchStockDetails(symbol) {
  try {
    const response = await fetch(`${API_URL_PROFILE}/${symbol}?apikey=${API_KEY}`);
    const data = await response.json();

    if (!data || !data[0]) throw new Error(`Failed to fetch details for ${symbol}.`);

    const stock = data[0];
    return {
      symbol: stock.symbol,
      price: stock.price || 0,
      change: stock.changesPercentage || 0,
      peRatio: stock.pe || "N/A",
      trend: stock.changesPercentage > 0 ? "Upward" : "Downward",
      reason: getPerformanceReason(stock),
    };
  } catch (error) {
    console.error(`Failed to fetch data for ${symbol}:`, error);
    return null; // Skip this stock
  }
}

// Determine why the stock is performing well
function getPerformanceReason(stock) {
  const reasons = [];
  if (stock.changesPercentage > 0) reasons.push("Positive price momentum");
  if (stock.pe && stock.pe < 20) reasons.push("Attractive P/E ratio");
  if (stock.changesPercentage > 5) reasons.push("Strong recent gains");
  return reasons.length > 0 ? reasons.join(", ") : "No specific reason identified";
}

// Persist weekly picks
function saveWeeklyPicks(stocks) {
  const now = new Date();
  const data = {
    stocks,
    expiry: new Date(now.setDate(now.getDate() + (7 - now.getDay()))), // Expire at the end of the current week
  };
  localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(data));
}

// Load weekly picks
function loadWeeklyPicks() {
  const data = JSON.parse(localStorage.getItem(WEEKLY_STORAGE_KEY));
  if (!data || new Date() > new Date(data.expiry)) return null; // Expired or no data
  return data.stocks;
}

// Add a stock to weekly picks if it meets strong criteria
function addStockToWeeklyPicks(stock, weeklyStocks) {
  if (stock.change > 5 && stock.trend === "Upward" && stock.peRatio !== "N/A" && stock.peRatio < 20) {
    weeklyStocks.push(stock);
  }
}

// Update stock table dynamically
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = ""; // Clear previous data

  try {
    const topStocks = await fetchTopStocks();
    const weeklyStocks = loadWeeklyPicks() || [];

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
          <td>${stockDetails.reason}</td>
        `;
        tbody.appendChild(row);

        // Add to weekly picks if it's a strong performer
        addStockToWeeklyPicks(stockDetails, weeklyStocks);
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
      }
    }

    // Save weekly picks to localStorage
    saveWeeklyPicks(weeklyStocks);

    // Update weekly picks section
    updateWeeklyStocksSection(weeklyStocks);
  } catch (error) {
    console.error("Error updating stock table:", error);
  }
}

// Update the weekly picks section
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
      <strong>${stock.symbol}</strong>: ${stock.reason}
    `;
    weeklyStocksList.appendChild(listItem);
  });
}

// Refresh the table every 3 minutes
setInterval(updateStockTable, 180000); // 3 minutes
updateStockTable();
