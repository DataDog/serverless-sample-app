import config from "/config.js";

let jwt = "";

$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  refreshData();
});

export function completeOrder(userId, orderId, completeBtn) {
  completeBtn.ariaBusy = "true";
  completeBtn.ariaLabel = "Completing...";
  completeBtn.innerText = "Completing...";

  var xhr = new XMLHttpRequest();

  xhr.open(
    "POST",
    `${config.ORDER_API_ENDPOINT}/orders/${orderId}/complete`,
    true
  );
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
  xhr.send(
    JSON.stringify({
      orderId: orderId,
      userId: userId,
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && (xhr.status == 201 || xhr.status == 200)) {
      refreshData();
    } else {
      console.log(`Error: ${xhr.status}`);
    }
  };
}

function refreshData() {
  let loadingSpinner = document.getElementById("loading");
  loadingSpinner.ariaBusy = true;
  let tableBodyElement = document.getElementById("tableBody");
  tableBodyElement.innerHTML = "";

  $.ajax({
    url: `${config.ORDER_API_ENDPOINT}/orders/confirmed`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      let items = response.items;

      if (!items) {
        items = response;
      }

      loadingSpinner.ariaBusy = false;
      items.forEach((message) => {
        console.log(message);

        var rowElement = document.createElement("tr");
        var orderNumberTableElement = document.createElement("td");
        orderNumberTableElement.innerText = message.orderId;

        var completeOrderButtonTableCell = document.createElement("td");
        var completeOrderButton = document.createElement("button");
        completeOrderButton.innerText = "Complete";
        completeOrderButton.onclick = function () {
          completeOrder(message.userId, message.orderId, completeOrderButton);
        };
        completeOrderButtonTableCell.appendChild(completeOrderButton);

        rowElement.appendChild(orderNumberTableElement);
        rowElement.appendChild(completeOrderButtonTableCell);

        tableBodyElement.appendChild(rowElement);
      });
    },
    error: function (xhr, status, error) {
      loadingSpinner.ariaBusy = false;
      alert("Login failed: " + error);
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
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

window.closeModal = closeModal;
window.completeOrder = completeOrder;
