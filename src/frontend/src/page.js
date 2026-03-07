import config from "./config.js";

let activeProduct = "";
let orderItems = [];
let orderItemsIDS = [];
let jwt = "";

$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  refreshData();

  document.getElementById("searchInput")?.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); runSearch(); }
  });
});

function viewProduct(productId, btnElement) {
  btnElement.ariaBusy = "true";
  btnElement.ariaLabel = "Opening...";
  btnElement.innerText = "Opening...";

  $.ajax({
    url: `${config.PRODUCT_API_ENDPOINT}/product/${productId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      let tableBodyElement = document.getElementById("pricingTableBody");
      tableBodyElement.innerHTML = "";

      (response.data.pricingBrackets ?? []).forEach((breakdown) => {
        const price = breakdown.price;
        const quantity = breakdown.quantity;

        var rowElement = document.createElement("tr");
        var priceCellElement = document.createElement("td");
        priceCellElement.textContent = price;
        var quantityCellElement = document.createElement("td");
        quantityCellElement.textContent = quantity;

        rowElement.appendChild(priceCellElement);
        rowElement.appendChild(quantityCellElement);

        tableBodyElement.appendChild(rowElement);
      });

      activeProduct = productId;

      let productModal = document.getElementById("productModal");
      productModal.setAttribute("open", "true");

      loadProductActivity(productId);

      btnElement.ariaBusy = "false";
      btnElement.ariaLabel = "View";
      btnElement.innerText = "View";
    },
    error: function (xhr, status, error) {
      btnElement.ariaBusy = "false";
      btnElement.ariaLabel = "View";
      btnElement.innerText = "View";
      alert("Failure loading product: " + error);
    },
  });
}

function createOrder() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", `${config.ORDER_API_ENDPOINT}/orders`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
  xhr.send(
    JSON.stringify({
      products: orderItemsIDS,
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 201)) {
      orderItems = [];
      orderItemsIDS = [];
      updateOrderDisplay();
      alert("Order created successfully");
      window.location.href = "/";
    } else {
      alert(`Order creation failed: ${xhr.status}`);
    }
  };
}

function addToOrder(name, productId) {
  orderItems.push({ productId: productId, name: name });
  orderItemsIDS.push(productId);

  updateOrderDisplay();
}

function updateOrderDisplay() {
  const orderList = document.getElementById("orderList");
  const emptyMessage = document.getElementById("emptyOrderMessage");
  const totalItems = document.getElementById("totalItems");
  const checkoutBtn = document.getElementById("checkoutBtn");

  orderList.innerHTML = "";

  if (orderItems.length > 0) {
    emptyMessage.style.display = "none";
    checkoutBtn.disabled = false;

    orderItems.forEach((item, index) => {
      const listItem = document.createElement("li");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = item.name;
      const removeBtn = document.createElement("button");
      removeBtn.className = "outline";
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => removeFromOrder(index);
      listItem.appendChild(nameSpan);
      listItem.appendChild(removeBtn);
      orderList.appendChild(listItem);
    });
  } else {
    emptyMessage.style.display = "block";
    checkoutBtn.disabled = true;
  }

  totalItems.textContent = orderItems.length;
}

function removeFromOrder(index) {
  orderItems.splice(index, 1);
  orderItemsIDS.splice(index, 1);
  updateOrderDisplay();
}

function buildProductCard(productId, productName, productPrice, productStock) {
  const header = document.createElement("header");
  const h3 = document.createElement("h3");
  h3.textContent = productName;
  header.appendChild(h3);

  const priceEl = document.createElement("p");
  priceEl.className = "price";
  priceEl.textContent = `$${productPrice}`;

  const stockEl = document.createElement("p");
  stockEl.className = "stock";
  stockEl.textContent = `${productStock} in stock`;

  const footer = document.createElement("footer");

  const viewBtn = document.createElement("button");
  viewBtn.className = "view-details";
  viewBtn.textContent = "View Details";
  viewBtn.onclick = () => viewProduct(productId, viewBtn);
  footer.appendChild(viewBtn);

  if (productStock > 0) {
    const addBtn = document.createElement("button");
    addBtn.className = "add-to-cart";
    addBtn.textContent = "Add to Order";
    addBtn.onclick = () => addToOrder(productName, productId);
    footer.appendChild(addBtn);
  }

  const card = document.createElement("article");
  card.className = "product-card";
  card.appendChild(header);
  card.appendChild(priceEl);
  card.appendChild(stockEl);
  card.appendChild(footer);
  return card;
}

function refreshData() {
  let loadingSpinner = document.getElementById("loading");
  loadingSpinner.ariaBusy = true;
  let productCardsElement = document.getElementById("productCards");
  productCardsElement.innerHTML = "";

  $.ajax({
    url: `${config.PRODUCT_API_ENDPOINT}/product`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      loadingSpinner.ariaBusy = false;
      response.data.forEach((product) => {
        if (product.stockLevel <= 0) {
          loadStockLevel(
            product,
            (productId, productName, productPrice, productStock) => {
              productCardsElement.appendChild(
                buildProductCard(productId, productName, productPrice, productStock)
              );
            }
          );
        } else {
          productCardsElement.appendChild(
            buildProductCard(product.productId, product.name, product.price, product.stockLevel)
          );
        }
      });
    },
    error: function (xhr, status, error) {
      loadingSpinner.ariaBusy = false;
      alert("Failed to load products: " + error);
    },
  });
}

function loadStockLevel(product, callback) {
  $.ajax({
    url: `${config.INVENTORY_API_ENDPOINT}/inventory/${product.productId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      if (response.data === null) {
        callback(product.productId, product.name, product.price, 0);
        return;
      }

      callback(
        product.productId,
        product.name,
        product.price,
        response.data.currentStockLevel
      );
    },
    error: function () {
      callback(product.productId, product.name, product.price, 0);
    },
  });
}

function loadProductActivity(productId) {
  $.ajax({
    url: `${config.ACTIVITY_API_ENDPOINT}/api/activity/product/${productId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      const container = document.getElementById("productActivityList");
      if (!container) return;

      const activities = response.activities ?? [];
      if (activities.length === 0) {
        container.innerHTML = "<li>No recent activity.</li>";
        return;
      }

      container.innerHTML = "";
      activities.forEach((activity) => {
        const tsValue = activity.activity_time ?? activity.timestamp;
        const ts = new Date(tsValue).toLocaleString();
        const eventName = activity.type ?? activity.event_name ?? "unknown";
        const li = document.createElement("li");
        li.textContent = `${eventName} — ${ts}`;
        container.appendChild(li);
      });
    },
    error: function () {
      // Activity is non-critical; silently fail
    },
  });
}

function closeModal() {
  activeProduct = "";
  let tableBodyElement = document.getElementById("pricingTableBody");
  tableBodyElement.innerHTML = "";
  let productModal = document.getElementById("productModal");
  let activityList = document.getElementById("productActivityList");
  if (activityList) activityList.innerHTML = "";

  productModal.removeAttribute("open");
}

function runSearch() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const searchBtn = document.getElementById("searchBtn");
  searchBtn.ariaBusy = "true";
  searchBtn.textContent = "Searching...";

  $.ajax({
    url: `${config.PRODUCT_SEARCH_ENDPOINT}/search`,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ query }),
    success: function (response) {
      searchBtn.ariaBusy = "false";
      searchBtn.textContent = "Search";
      displaySearchResults(response);
    },
    error: function (xhr) {
      searchBtn.ariaBusy = "false";
      searchBtn.textContent = "Search";
      const msg = xhr.responseJSON?.error ?? "Search failed. Please try again.";
      alert(msg);
    },
  });
}

function displaySearchResults(response) {
  const answerEl = document.getElementById("searchAnswer");
  answerEl.textContent = response.answer;

  const searchCards = document.getElementById("searchProductCards");
  while (searchCards.firstChild) { searchCards.removeChild(searchCards.firstChild); }
  (response.products ?? []).forEach((product) => {
    searchCards.appendChild(
      buildProductCard(product.productId, product.name, product.price, product.stockLevel)
    );
  });

  document.getElementById("productCards").style.display = "none";
  document.getElementById("searchResults").style.display = "block";
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  document.getElementById("searchResults").style.display = "none";
  document.getElementById("searchAnswer").textContent = "";
  const searchCards = document.getElementById("searchProductCards");
  while (searchCards.firstChild) { searchCards.removeChild(searchCards.firstChild); }
  document.getElementById("productCards").style.display = "";
}

window.closeProductModal = closeModal;
window.addToOrder = addToOrder;
window.createOrder = createOrder;
window.removeFromOrder = removeFromOrder;
window.viewProduct = viewProduct;
window.runSearch = runSearch;
window.clearSearch = clearSearch;
