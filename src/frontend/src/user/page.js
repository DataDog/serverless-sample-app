import config from "../config.js";

let jwt = "";
$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  refreshData();
});

function refreshData() {
  let loadingSpinner = document.getElementById("loading");
  loadingSpinner.ariaBusy = true;

  let user_id = localStorage.getItem("userId");

  $.ajax({
    url: `${config.USER_API_ENDPOINT}/user/${user_id}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      let contentsElement = document.getElementById("contents");

      contentsElement.innerHTML = `
          <header>
            <h3>${response.data.firstName} ${response.data.lastName}</h3>
          </header>
          <p class="price">Order Count: ${response.data.orderCount}</p>
        `;

      loadingSpinner.ariaBusy = false;
    },
    error: function (xhr, status, error) {
      loadingSpinner.ariaBusy = false;
      alert("Failed to load user details: " + error);
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });

  $.ajax({
    url: `${config.LOYALTY_API_ENDPOINT}/loyalty`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      loadingSpinner.ariaBusy = false;
      console.log(response);

      let pointsElement = document.getElementById("points");
      pointsElement.innerText = `Points: ${response.data.currentPoints}`;
    },
    error: function (xhr, status, error) {
      loadingSpinner.ariaBusy = false;
      alert("Failed to load loyalty information: " + error);
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });

  let orderCardsElement = document.getElementById("orderCards");
  orderCardsElement.innerHTML = "";

  $.ajax({
    url: `${config.ORDER_API_ENDPOINT}/orders`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      loadingSpinner.ariaBusy = false;
      console.log(response);
      response.forEach((order) => {
        const orderCard = document.createElement("article");
        orderCard.className = "product-card";

        orderCard.innerHTML = `
          <header>
            <h3>${order.orderId}</h3>
          </header>
          <p class="price">Status: ${order.status}</p>
          <p class="stock">Items: ${order.products.length}</p>
          <footer>
          </footer>
        `;

        orderCardsElement.appendChild(orderCard);
      });
    },
    error: function (xhr, status, error) {
      loadingSpinner.ariaBusy = false;
      alert("Failed to load orders: " + error);
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });
}
