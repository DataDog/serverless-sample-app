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

      loadUserActivity(user_id);
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

      renderSpendPointsForm(response.data.currentPoints);
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
      response.items.forEach((order) => {
        const orderCard = document.createElement("article");
        orderCard.className = "product-card";

        const activityContainerId = `activity-${order.orderId}`;
        const detailContainerId = `detail-${order.orderId}`;

        orderCard.innerHTML = `
          <header>
            <h3>${order.orderId}</h3>
          </header>
          <p class="price">Status: ${order.orderStatus}</p>
          <p class="stock">Items: ${order.products.length}</p>
          <footer>
            <button class="outline" onclick="viewOrderDetail('${order.orderId}', this)">View Details</button>
          </footer>
          <div id="${detailContainerId}" style="display:none;"></div>
          <div id="${activityContainerId}"></div>
        `;

        orderCardsElement.appendChild(orderCard);

        loadOrderActivity(order.orderId, activityContainerId);
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

function renderSpendPointsForm(currentPoints) {
  let spendPointsElement = document.getElementById("spendPoints");
  if (!spendPointsElement) return;

  spendPointsElement.innerHTML = `
    <fieldset role="group">
      <input
        id="pointsToSpend"
        type="number"
        min="1"
        max="${currentPoints}"
        placeholder="Points to spend"
        aria-label="Points to spend"
      />
      <button onclick="spendPoints()">Spend Points</button>
    </fieldset>
    <p id="spendPointsError" style="color:var(--del-color);display:none;"></p>
  `;
}

function spendPoints() {
  const pointsInput = document.getElementById("pointsToSpend");
  const errorElement = document.getElementById("spendPointsError");
  const points = Number.parseInt(pointsInput.value);

  if (!points || points <= 0) {
    errorElement.innerText = "Please enter a valid number of points.";
    errorElement.style.display = "block";
    return;
  }

  errorElement.style.display = "none";

  $.ajax({
    url: `${config.LOYALTY_API_ENDPOINT}/loyalty`,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ points }),
    success: function (response) {
      if (response.success) {
        let pointsElement = document.getElementById("points");
        pointsElement.innerText = `Points: ${response.data.currentPoints}`;
        renderSpendPointsForm(response.data.currentPoints);
      } else {
        errorElement.innerText = (response.message ?? []).join(", ") || "Failed to spend points.";
        errorElement.style.display = "block";
      }
    },
    error: function (xhr, status, error) {
      errorElement.innerText = "Error spending points: " + error;
      errorElement.style.display = "block";
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });
}

function viewOrderDetail(orderId, btnElement) {
  const detailContainerId = `detail-${orderId}`;
  const detailContainer = document.getElementById(detailContainerId);

  if (detailContainer.style.display !== "none") {
    detailContainer.style.display = "none";
    btnElement.innerText = "View Details";
    return;
  }

  btnElement.ariaBusy = "true";
  btnElement.innerText = "Loading...";

  $.ajax({
    url: `${config.ORDER_API_ENDPOINT}/orders/${orderId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      const order = response;
      const orderDate = new Date(order.orderDate).toLocaleDateString();

      detailContainer.innerHTML = `
        <hr />
        <h4>Order Details</h4>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Date:</strong> ${orderDate}</p>
        <p><strong>Type:</strong> ${order.orderType}</p>
        <p><strong>Status:</strong> ${order.orderStatus}</p>
        <p><strong>Total Price:</strong> $${order.totalPrice}</p>
        <p><strong>Products:</strong> ${order.products.join(", ")}</p>
      `;

      detailContainer.style.display = "block";
      btnElement.ariaBusy = "false";
      btnElement.innerText = "Hide Details";
    },
    error: function (xhr, status, error) {
      detailContainer.innerHTML = `<p style="color:var(--del-color);">Failed to load order details: ${error}</p>`;
      detailContainer.style.display = "block";
      btnElement.ariaBusy = "false";
      btnElement.innerText = "View Details";
    },
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    },
  });
}

function loadOrderActivity(orderId, containerId) {
  $.ajax({
    url: `${config.ACTIVITY_API_ENDPOINT}/api/activity/order/${orderId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const activities = response.activities ?? [];
      if (activities.length === 0) return;

      let activityHtml = `<details><summary>Activity (${activities.length})</summary><ul>`;
      activities.forEach((activity) => {
        const tsValue = activity.activity_time ?? activity.timestamp;
        const ts = new Date(tsValue).toLocaleString();
        const eventName = activity.type ?? activity.event_name ?? "unknown";
        activityHtml += `<li>${eventName} &mdash; ${ts}</li>`;
      });
      activityHtml += `</ul></details>`;

      container.innerHTML = activityHtml;
    },
    error: function () {
      // Activity is non-critical; silently fail
    },
  });
}

function loadUserActivity(userId) {
  $.ajax({
    url: `${config.ACTIVITY_API_ENDPOINT}/api/activity/user/${userId}`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      const container = document.getElementById("userActivity");
      if (!container) return;

      const activities = response.activities ?? [];
      if (activities.length === 0) {
        container.innerHTML = `<p>No recent activity.</p>`;
        return;
      }

      let activityHtml = `<ul>`;
      activities.forEach((activity) => {
        const tsValue = activity.activity_time ?? activity.timestamp;
        const ts = new Date(tsValue).toLocaleString();
        const eventName = activity.type ?? activity.event_name ?? "unknown";
        activityHtml += `<li>${eventName} &mdash; ${ts}</li>`;
      });
      activityHtml += `</ul>`;

      container.innerHTML = activityHtml;
    },
    error: function () {
      // Activity is non-critical; silently fail
    },
  });
}

window.spendPoints = spendPoints;
window.viewOrderDetail = viewOrderDetail;
