const API_KEY = "ct8h0mpr01qtkv5sb890ct8h0mpr01qtkv5sb89g";
const API_URL_TOP_STOCKS = `https://finnhub.io/api/v1/stock/symbol`;
const API_URL_QUOTE = `https://finnhub.io/api/v1/quote`;
const API_URL_METRICS = `https://finnhub.io/api/v1/stock/metric`;

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";

// Fetch top-performing stocks (limit to 20)
async function fetchTopStocks() {
  try {
    const response = await fetch(`${API_URL_TOP_STOCKS}?exchange=US&token=${API_KEY}`);
    const data = await response.json();
    if (!data || !Array.isArray(data)) throw new Error("Failed to fetch stock symbols.");

    // Limit to 20 stocks per refresh
    return data.slice(0, 20).map((stock) => stock.symbol);
  } catch (error) {
    console.error("Error fetching top stocks:", error);
    return [];
  }
}

// Fetch detailed stock data, including manually calculated P/E ratio and EPS
async function fetchStockDetails(symbol) {
  const [quoteResponse, metricResponse] = await Promise.all([
    fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${API_KEY}`),
    fetch(`${API_URL_METRICS}?symbol=${symbol}&metric=all&token=${API_KEY}`),
  ]);

  const quoteData = await quoteResponse.json();
  const metricData = await metricResponse.json();

  // Log the full metric data for debugging
  console.log(`Metric Data for ${symbol}:`, metricData);

  if (!quoteData || !metricData) throw new Error(`Failed to fetch details for ${symbol}.`);

  // Attempt to fetch EPS from multiple sources
  const eps =
    metricData.metric?.epsBasicTTM ||
    metricData.metric?.epsDilutedTTM ||
    metricData.metric?.epsReported ||
    null;

  // Log EPS data
  console.log(`EPS for ${symbol}:`, {
    epsBasicTTM: metricData.metric?.epsBasicTTM,
    epsDilutedTTM: metricData.metric?.epsDilutedTTM,
    epsReported: metricData.metric?.epsReported,
    selectedEPS: eps,
  });

  // Calculate P/E ratio
  const peRatio = eps ? (quoteData.c / eps).toFixed(2) : "N/A";

  const trend = quoteData.c > quoteData.pc ? "Upward" : "Downward";

  return {
    symbol,
    price: quoteData.c,
    change: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
    eps: eps ? eps.toFixed(2) : "N/A",
    peRatio: peRatio,
    trend: trend,
    reason: getPerformanceReason(quoteData, peRatio, trend),
  };
}
// Determine why the stock is performing well
function getPerformanceReason(quoteData, peRatio, trend) {
  const reasons = [];
  if (trend === "Upward") reasons.push("Positive price momentum");
  if (peRatio !== "N/A" && peRatio < 20) reasons.push("Attractive P/E ratio");
  if (quoteData.c > quoteData.pc * 1.05) reasons.push("Strong recent gains");
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
  if (stock.trend === "Upward" && stock.change > 5 && stock.peRatio !== "N/A" && stock.peRatio < 20) {
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

        if (!stockDetails || stockDetails.trend === "Downward") {
          // Skip downward-trending stocks
          console.log(`Skipping ${symbol} due to downward trend.`);
          continue;
        }

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stockDetails.symbol}</td>
          <td>${stockDetails.price.toFixed(2)}</td>
          <td>${stockDetails.change.toFixed(2)}%</td>
          <td>${stockDetails.eps}</td>
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
