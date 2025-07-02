import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt user for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Configuration function
async function configure() {
  console.log("=== MCP Client Configuration ===");
  
  const endpoint = await prompt("Enter MCP Server Endpoint (press Enter for default: http://localhost:3000/mcp): ");
  const endpointUrl = endpoint.trim() || "http://localhost:3000/mcp";
  
  const token = await prompt("Enter your Bearer Token: ");
  
  if (!token.trim()) {
    console.log("Error: Bearer token is required!");
    process.exit(1);
  }
  
  return { endpointUrl, token: token.trim() };
}

// Initialize MCP client
async function initializeClient(endpointUrl, token) {
  console.log(`\nConnecting to ${endpointUrl}...`);
  
  const transport = new StreamableHTTPClientTransport(new URL(endpointUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const client = new Client({
    name: "interactive-node-client",
    version: "0.0.1",
  });

  try {
    await client.connect(transport);
    console.log("✅ Connected successfully!");
    return client;
  } catch (error) {
    console.log("❌ Failed to connect:", error.message);
    process.exit(1);
  }
}

// Display menu
function displayMenu() {
  console.log("\n=== MCP Client Menu ===");
  console.log("1) List all orders");
  console.log("2) Get specific order");
  console.log("3) List available products");
  console.log("4) Create order");
  console.log("5) Exit");
  console.log("========================");
}

// Handle menu options
async function handleMenuOption(client, option) {
  try {
    switch (option) {
      case '1':
        console.log("\n📋 Listing all orders...");
        const orders = await client.callTool({
          name: "getMyOrders",
          arguments: {},
        });
        console.log("Orders:", JSON.stringify(orders, null, 2));
        break;

      case '2':
        const orderId = await prompt("Enter Order ID: ");
        if (!orderId.trim()) {
          console.log("❌ Order ID is required!");
          break;
        }
        console.log(`\n📄 Getting order ${orderId}...`);
        const order = await client.callTool({
          name: "getOrder",
          arguments: { orderId: orderId.trim() },
        });
        console.log("Order details:", JSON.stringify(order, null, 2));
        break;

      case '3':
        console.log("\n🛍️  Listing available products...");
        const products = await client.callTool({
          name: "availableProducts",
          arguments: {},
        });
        console.log("Available products:", JSON.stringify(products, null, 2));
        break;

      case '4':
        console.log("\n🛒 Creating new order...");
        
        // First, show available products
        const availableProducts = await client.callTool({
          name: "availableProducts",
          arguments: {},
        });
        
        console.log("Available products:");
        if (availableProducts.content && availableProducts.content[0] && availableProducts.content[0].text) {
          console.log(availableProducts.content[0].text);
        } else {
          console.log(JSON.stringify(availableProducts, null, 2));
        }
        
        const productInput = await prompt("Enter products to order (comma-separated, e.g., LATTE,CAPPUCCINO): ");
        
        if (!productInput.trim()) {
          console.log("❌ At least one product is required!");
          break;
        }
        
        const productsOnOrder = productInput.split(',').map(p => p.trim().toUpperCase()).filter(p => p);
        
        console.log(`Creating order with products: ${productsOnOrder.join(', ')}`);
        
        const createOrderResult = await client.callTool({
          name: "createOrder",
          arguments: { productsOnOrder },
        });
        
        console.log("✅ Order created:", JSON.stringify(createOrderResult, null, 2));
        break;

      case '5':
        console.log("\n👋 Goodbye!");
        return false;

      default:
        console.log("❌ Invalid option. Please choose 1-5.");
        break;
    }
  } catch (error) {
    console.log("❌ Error executing command:", error.message);
  }
  
  return true;
}

// Main application loop
async function main() {
  try {
    // Configuration
    const { endpointUrl, token } = await configure();
    
    // Initialize client
    const client = await initializeClient(endpointUrl, token);
    
    // Show available tools
    const tools = await client.listTools();
    console.log(`\n📊 Available tools: ${tools.tools.map(t => t.name).join(', ')}`);
    
    // Interactive menu loop
    let continueLoop = true;
    while (continueLoop) {
      displayMenu();
      const choice = await prompt("Choose an option (1-5): ");
      continueLoop = await handleMenuOption(client, choice.trim());
    }
    
    // Cleanup
    await client.close();
    rl.close();
    
  } catch (error) {
    console.log("❌ Application error:", error.message);
    rl.close();
    process.exit(1);
  }
}

// Start the application
main();
