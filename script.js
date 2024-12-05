const API_KEY_POLYGON = "f8Nd_Rd1hFTyB1BlWRJPmEnPj_or8R4f"; // Replace with your Polygon.io API key
const API_URL_TICKERS = `https://api.polygon.io/v3/reference/tickers`; // For stock symbols
const API_URL_QUOTE = `https://api.polygon.io/v2/last/nbbo`; // For real-time quotes
const API_URL_FUNDAMENTALS = `https://api.polygon.io/vX/reference/financials`; // For EPS and P/E Ratio

const WEEKLY_STORAGE_KEY = "topWeeklyStocks";

// Fetch top-performing stocks (limit to 20)
async function fetchTopStocks() {
  try {
    console.log("Fetching top stocks...");
    const response = await fetch(`${API_URL_TICKERS}?market=stocks&active=true&sort=ticker&limit=20&apiKey=${API_KEY_POLYGON}`);
    const data = await response.json();
    console.log("Top stocks response:", data);

    if (!data || !data.results || !Array.isArray(data.results)) throw new Error("Failed to fetch stock symbols.");
    return data.results.map((stock) => stock.ticker);
  } catch (error) {
    console.error("Error fetching top stocks:", error);
    return [];
  }
}

// Fetch detailed stock data, including EPS and P/E ratio
async function fetchStockDetails(symbol) {
  try {
    console.log(`Fetching details for ${symbol}...`);
    const quoteResponse = await fetch(`${API_URL_QUOTE}/${symbol}?apiKey=${API_KEY_POLYGON}`);
    const fundamentalsResponse = await fetch(`${API_URL_FUNDAMENTALS}/${symbol}?apiKey=${API_KEY_POLYGON}`);

    const quoteData = await quoteResponse.json();
    const fundamentalsData = await fundamentalsResponse.json();

    console.log("Quote response:", quoteData);
    console.log("Fundamentals response:", fundamentalsData);

    if (!quoteData.last || !fundamentalsData.results[0]) {
      console.error(`Data missing for ${symbol}`);
      return null;
    }

    const quote = quoteData.last;
    const fundamentals = fundamentalsData.results[0];

    return {
      symbol: symbol,
      price: quote.bidprice || 0,
      change: quote.askprice - quote.bidprice || 0,
      eps: fundamentals.eps || "N/A", // EPS from fundamentals
      peRatio: fundamentals.pe_ratio || "N/A", // P/E Ratio from fundamentals
      trend: quote.askprice > quote.bidprice ? "Upward" : "Downward",
      reason: getPerformanceReason(quote, fundamentals),
    };
  } catch (error) {
    console.error(`Failed to fetch details for ${symbol}:`, error);
    return null;
  }
}

// Determine why the stock is performing well
function getPerformanceReason(quote, fundamentals) {
  const reasons = [];
  if (quote.askprice > quote.bidprice) reasons.push("Positive price momentum");
  if (fundamentals.pe_ratio !== "N/A" && fundamentals.pe_ratio < 20) reasons.push("Attractive P/E ratio");
  if (quote.askprice - quote.bidprice > 5) reasons.push("Strong recent gains");
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
