import config from "/config.js";

let activeProduct = "";
let jwt = "";

$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  refreshData();
});

export function createProduct() {
  const createBtn = document.getElementById("createProductBtn");
  createBtn.ariaBusy = "true";
  createBtn.ariaLabel = "Creating...";
  createBtn.innerText = "Creating...";

  const name = document.getElementById("productName").value;
  const price = document.getElementById("productPrice").value;

  if (name.length <= 0) {
    alert("Name must not be empty");
    return;
  }

  if (price.length <= 0) {
    alert("Price must not be empty");
    return;
  }

  var xhr = new XMLHttpRequest();

  console.log(`Bearer ${jwt}`);
  xhr.open("POST", `${config.PRODUCT_API_ENDPOINT}/product`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
  xhr.send(
    JSON.stringify({
      name: name,
      price: Number.parseFloat(price),
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && (xhr.status == 201 || xhr.status == 200)) {
      refreshData();
      document.getElementById("productName").value = "";
      document.getElementById("productPrice").value = "";
      document.getElementById("productName").focus();
      document.getElementById("productName").select();
    } else {
      console.log(`Error: ${xhr.status}`);
    }

    createBtn.ariaBusy = "false";
    createBtn.ariaLabel = "";
    createBtn.innerText = "Create";
  };
}

export function updateProduct() {
  const name = document.getElementById("updateProductName").value;
  const price = document.getElementById("updateProductPrice").value;

  if (name.length <= 0) {
    alert("Name must not be empty");
    return;
  }

  if (price.length <= 0) {
    alert("Price must not be empty");
    return;
  }

  const createBtn = document.getElementById("updateProductBtn");
  createBtn.ariaBusy = "true";
  createBtn.ariaLabel = "Updating...";
  createBtn.innerText = "Updating...";

  var xhr = new XMLHttpRequest();
  xhr.open("PUT", `${config.PRODUCT_API_ENDPOINT}/product`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
  xhr.send(
    JSON.stringify({
      name: name,
      price: Number.parseFloat(price),
      id: activeProduct,
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      refreshData();
      closeModal();
    } else {
      console.log(`Error: ${xhr.status}`);
    }

    createBtn.ariaBusy = "false";
    createBtn.ariaLabel = "";
    createBtn.innerText = "Create";
  };
}

function deleteProduct(productId, btnElement) {
  btnElement.ariaBusy = "true";
  btnElement.ariaLabel = "Deleting...";
  btnElement.innerText = "Deleting...";

  var xhr = new XMLHttpRequest();
  xhr.open(
    "DELETE",
    `${config.PRODUCT_API_ENDPOINT}/product/${productId}`,
    true
  );
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
  xhr.send();
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      refreshData();
    } else {
      console.log(`Error: ${xhr.status}`);
    }
  };
}

function viewProduct(productId, btnElement) {
  btnElement.ariaBusy = "true";
  btnElement.ariaLabel = "Opening...";
  btnElement.innerText = "Opening...";

  $.ajax({
    url: `${config.PRODUCT_API_ENDPOINT}/product/${productId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      let updateNameElement = document.getElementById("updateProductName");
      updateNameElement.value = response.data.name;
      let updatePriceElement = document.getElementById("updateProductPrice");
      updatePriceElement.value = response.data.price;

      let tableBodyElement = document.getElementById("pricingTableBody");
      tableBodyElement.innerHTML = "";

      let productTitle = document.getElementById("productName");
      productTitle.innerText = response.data.name;

      (response.data.pricingBrackets ?? []).forEach((breakdown) => {
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

      loadStockLevel(productId);
    },
    error: function (xhr, status, error) {
      alert("Failure loading product: " + error);
    },
  });

  btnElement.ariaBusy = "false";
  btnElement.ariaLabel = "View";
  btnElement.innerText = "View";
}

function loadStockLevel(productId) {
  console.log(`${config.INVENTORY_API_ENDPOINT}/inventory/${productId}`);
  $.ajax({
    url: `${config.INVENTORY_API_ENDPOINT}/inventory/${productId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      console.log(response);

      let updateStockLevelElement = document.getElementById("updateStockLevel");
      updateStockLevelElement.value = response.data.currentStockLevel;
    },
    error: function (xhr, status, error) {
      console.log("Failure loading stock: " + error);
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });
}

function updateStock() {
  const newStockLevel = document.getElementById("updateStockLevel").value;

  if (newStockLevel.length <= 0) {
    alert("Name must not be empty");
    return;
  }

  const updateStockBtn = document.getElementById("updateStockLevelBtn");
  updateStockBtn.ariaBusy = "true";
  updateStockBtn.ariaLabel = "Updating...";
  updateStockBtn.innerText = "Updating...";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", `${config.INVENTORY_API_ENDPOINT}/inventory`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
  xhr.send(
    JSON.stringify({
      productId: activeProduct,
      stockLevel: Number.parseInt(newStockLevel),
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      refreshData();
      closeModal();
    } else {
      console.log(`Error: ${xhr.status}`);
    }

    updateStockBtn.ariaBusy = "false";
    updateStockBtn.ariaLabel = "";
    updateStockBtn.innerText = "Create";
  };
}

function refreshData() {
  let loadingSpinner = document.getElementById("loading");
  loadingSpinner.ariaBusy = true;
  let tableBodyElement = document.getElementById("tableBody");
  tableBodyElement.innerHTML = "";

  $.ajax({
    url: `${config.PRODUCT_API_ENDPOINT}/product`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      loadingSpinner.ariaBusy = false;
      response.data.forEach((message) => {
        const productName = message.name;
        const price = message.price;

        var rowElement = document.createElement("tr");
        var nameCellElement = document.createElement("td");
        nameCellElement.innerText = productName;
        var priceCellElement = document.createElement("td");
        priceCellElement.innerText = price;

        var deleteButtonTableCell = document.createElement("td");
        var deleteButton = document.createElement("button");
        deleteButton.innerText = "Delete";
        deleteButton.onclick = function () {
          deleteProduct(message.productId, deleteButton);
        };
        deleteButtonTableCell.appendChild(deleteButton);

        var viewButtonTableCell = document.createElement("td");
        var openButton = document.createElement("button");
        openButton.innerText = "Open";
        openButton.onclick = function () {
          viewProduct(message.productId, openButton);
        };

        viewButtonTableCell.appendChild(openButton);

        rowElement.appendChild(nameCellElement);
        rowElement.appendChild(priceCellElement);
        rowElement.appendChild(viewButtonTableCell);
        rowElement.appendChild(deleteButtonTableCell);

        tableBodyElement.appendChild(rowElement);
      });
    },
    error: function (xhr, status, error) {
      loadingSpinner.ariaBusy = false;
      alert("Login failed: " + error);
    },
  });
}

function closeModal() {
  activeProduct = "";
  let tableBodyElement = document.getElementById("pricingTableBody");
  tableBodyElement.innerHTML = "";
  let productModal = document.getElementById("productModal");

  let updateNameElement = document.getElementById("updateProductName");
  updateNameElement.value = "";
  let updatePriceElement = document.getElementById("updateProductPrice");
  updatePriceElement.value = "";

  productModal.setAttribute("open", "false");
}

window.updateProduct = updateProduct;
window.createProduct = createProduct;
window.closeModal = closeModal;
window.updateStock = updateStock;
