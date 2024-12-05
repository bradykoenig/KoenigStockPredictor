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

// Find the best stock from the list
function findBestStock(stocks) {
  return stocks.reduce((best, current) => {
    if (!best || current.change > best.change) {
      return current;
    }
    return best;
  }, null);
}

// Update stock table dynamically
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = ""; // Clear previous data

  try {
    const topStocks = await fetchTopStocks();
    const stockDetailsList = [];

    for (const symbol of topStocks) {
      try {
        const stockDetails = await fetchStockDetails(symbol);

        if (!stockDetails || stockDetails.trend === "Downward") {
          console.log(`Skipping ${symbol} due to downward trend.`);
          continue;
        }

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
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
      }
    }

    // Find the best stock
    const bestStock = findBestStock(stockDetailsList);

    // Update the leaderboard with the best stock
    updateDailyStocksSection(bestStock ? [bestStock] : []);

  } catch (error) {
    console.error("Error updating stock table:", error);
  }
}

// Update the daily leaderboard section
function updateDailyStocksSection(bestStock) {
  const dailyStocksList = document.getElementById("dailyStocks");
  dailyStocksList.innerHTML = ""; // Clear previous list

  if (!bestStock || bestStock.length === 0) {
    dailyStocksList.innerHTML = "<li>No top stock today</li>";
    return;
  }

  const stock = bestStock[0];
  const listItem = document.createElement("li");
  listItem.innerHTML = `
    <strong>${stock.symbol}</strong>: ${stock.reason} (${stock.change}%)
  `;
  dailyStocksList.appendChild(listItem);
}

// Refresh the table every 3 minutes
setInterval(updateStockTable, 180000); // 3 minutes
updateStockTable();
