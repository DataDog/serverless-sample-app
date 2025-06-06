import config from "./config.js";

let activeProduct = "";
let orderItems = [];
let orderItemsIDS = [];
let jwt = "";

$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  refreshData();
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

      response.data.pricingBrackets.forEach((breakdown) => {
        const price = breakdown.price;
        const quantity = breakdown.quantity;

        var rowElement = document.createElement("tr");
        var priceCellElement = document.createElement("td");
        priceCellElement.innerText = price;
        var quantityCellElement = document.createElement("td");
        quantityCellElement.innerText = quantity;

        rowElement.appendChild(priceCellElement);
        rowElement.appendChild(quantityCellElement);

        tableBodyElement.appendChild(rowElement);
      });

      activeProduct = productId;

      let productModal = document.getElementById("productModal");
      productModal.setAttribute("open", "true");
    },
    error: function (xhr, status, error) {
      alert("Failure loading product: " + error);
    },
  });

  btnElement.ariaBusy = "false";
  btnElement.ariaLabel = "View";
  btnElement.innerText = "View";
}

function createOrder() {
  console.log(`Bearer ${jwt}`);
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
    if (xhr.readyState == 4 && xhr.status == 200) {
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

  // Clear the current list
  orderList.innerHTML = "";

  if (orderItems.length > 0) {
    // Hide empty message and enable checkout button
    emptyMessage.style.display = "none";
    checkoutBtn.disabled = false;

    // Add each item to the order list
    orderItems.forEach((item, index) => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        ${item.name}
        <button class="outline" onclick="removeFromOrder(${index})">Remove</button>
      `;
      orderList.appendChild(listItem);
    });
  } else {
    // Show empty message and disable checkout button
    emptyMessage.style.display = "block";
    checkoutBtn.disabled = true;
  }

  // Update total items count
  totalItems.textContent = orderItems.length;
}

function removeFromOrder(index) {
  orderItems.splice(index, 1);
  orderItemsIDS.splice(index, 1);
  updateOrderDisplay();
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
        const productCard = document.createElement("article");
        productCard.className = "product-card";

        if (product.stockLevel <= 0) {
          loadStockLevel(
            product,
            (productId, productName, productPrice, productStock) => {
              productCard.innerHTML = `
          <header>
            <h3>${productName}</h3>
          </header>
          <p class="price">$${productPrice}</p>
          <p class="stock">${productStock} in stock</p>
          <footer>
            <button class="view-details" onclick="viewProductDetails('${productId}', this)">View Details</button>
            ${
              productStock > 0
                ? `<button class="add-to-cart" onclick="addToOrder('${productName}', '${productId}')">Add to Order</button>`
                : ""
            }
          </footer>
        `;

              productCardsElement.appendChild(productCard);
            }
          );
        } else {
          productCard.innerHTML = `
          <header>
            <h3>${product.name}</h3>
          </header>
          <p class="price">$${product.price}</p>
          <p class="stock">${product.stockLevel} in stock</p>
          <footer>
            <button class="view-details" onclick="viewProductDetails('${
              product.productId
            }', this)">View Details</button>
            ${
              product.stockLevel > 0
                ? `<button class="add-to-cart" onclick="addToOrder('${product.name}', '${product.productId}')">Add to Order</button>`
                : ""
            }
          </footer>
        `;

          productCardsElement.appendChild(productCard);
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
      console.log(`Loading stock for ${product.productId}`);
      console.log(response);

      if (response.data === null) {
        callback(product.productId, product.name, product.price, 0);
        return 0;
      }

      console.log(response.data.currentStockLevel);

      callback(
        product.productId,
        product.name,
        product.price,
        response.data.currentStockLevel
      );

      return response.data.currentStockLevel;
    },
    error: function (xhr, status, error) {
      callback(
        product.productId,
        product.name,
        product.price,
        0
      );
      return 0;
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });
}

function viewProductDetails(productId, btnElement) {
  viewProduct(productId, btnElement);
}

function closeModal() {
  activeProduct = "";
  let tableBodyElement = document.getElementById("pricingTableBody");
  tableBodyElement.innerHTML = "";
  let productModal = document.getElementById("productModal");

  productModal.setAttribute("open", "false");
}

window.closeModal = closeModal;
window.addToOrder = addToOrder;
window.createOrder = createOrder;
window.removeFromOrder = removeFromOrder;
window.viewProductDetails = viewProductDetails;
