const API_KEY = "ct8h0mpr01qtkv5sb890ct8h0mpr01qtkv5sb89g";
const API_URL_TOP_STOCKS = `https://finnhub.io/api/v1/stock/symbol`;
const API_URL_QUOTE = `https://finnhub.io/api/v1/quote`;
const API_URL_PROFILE = `https://finnhub.io/api/v1/stock/profile2`;

// Fetch all US stocks and filter the top-performing ones
async function fetchTopStocks() {
  const response = await fetch(`${API_URL_TOP_STOCKS}?exchange=US&token=${API_KEY}`);
  const data = await response.json();
  if (!data || !Array.isArray(data)) throw new Error("Failed to fetch stock symbols.");
  
  // Return the first 10 US stocks (You can adjust this logic for specific criteria)
  return data.slice(0, 10).map(stock => stock.symbol);
}

// Fetch detailed stock data
async function fetchStockDetails(symbol) {
  const [quoteResponse, profileResponse] = await Promise.all([
    fetch(`${API_URL_QUOTE}?symbol=${symbol}&token=${API_KEY}`),
    fetch(`${API_URL_PROFILE}?symbol=${symbol}&token=${API_KEY}`),
  ]);

  const quoteData = await quoteResponse.json();
  const profileData = await profileResponse.json();

  if (!quoteData || !profileData)
    throw new Error(`Failed to fetch details for ${symbol}.`);

  return {
    symbol,
    price: quoteData.c,
    change: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
    peRatio: profileData.pe,
    trend: quoteData.c > quoteData.pc ? "Upward" : "Downward",
  };
}

// Update stock table dynamically
async function updateStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  tbody.innerHTML = ""; // Clear previous data

  try {
    const topStocks = await fetchTopStocks();

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
        `;
        tbody.appendChild(row);
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
      }
    }
  } catch (error) {
    console.error("Error updating stock table:", error);
  }
}

// Refresh the table every 10 seconds
setInterval(updateStockTable, 10000);
updateStockTable();
