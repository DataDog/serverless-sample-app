import config from "../config.js";

let jwt = "";
$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  if (!jwt) {
    window.location.href = "/login";
    return;
  }
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

      contentsElement.innerHTML = '';
      const header = document.createElement('header');
      const h3 = document.createElement('h3');
      h3.textContent = `${response.data.firstName} ${response.data.lastName}`;
      header.appendChild(h3);
      const orderCountP = document.createElement('p');
      orderCountP.className = 'price';
      orderCountP.textContent = `Order Count: ${response.data.orderCount}`;
      contentsElement.appendChild(header);
      contentsElement.appendChild(orderCountP);

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
      response.items.forEach((order) => {
        const orderCard = document.createElement("article");
        orderCard.className = "product-card";

        const activityContainerId = `activity-${order.orderId}`;
        const detailContainerId = `detail-${order.orderId}`;

        const cardHeader = document.createElement('header');
        const cardTitle = document.createElement('h3');
        cardTitle.textContent = order.orderId;
        cardHeader.appendChild(cardTitle);

        const statusP = document.createElement('p');
        statusP.className = 'price';
        statusP.textContent = `Status: ${order.orderStatus ?? order.status ?? order.order_status ?? '—'}`;

        const itemsP = document.createElement('p');
        itemsP.className = 'stock';
        itemsP.textContent = `Items: ${(order.products ?? []).length}`;

        const detailDiv = document.createElement('div');
        detailDiv.id = detailContainerId;
        detailDiv.style.display = 'none';
        detailDiv.style.padding = '0 1.25rem 0.75rem';

        const activityDiv = document.createElement('div');
        activityDiv.id = activityContainerId;

        const cardFooter = document.createElement('footer');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'view-details';
        viewBtn.textContent = 'View Details';
        viewBtn.addEventListener('click', function() {
          viewOrderDetail(order.orderId, viewBtn);
        });
        cardFooter.appendChild(viewBtn);

        orderCard.appendChild(cardHeader);
        orderCard.appendChild(statusP);
        orderCard.appendChild(itemsP);
        orderCard.appendChild(detailDiv);
        orderCard.appendChild(activityDiv);
        orderCard.appendChild(cardFooter);

        orderCardsElement.appendChild(orderCard);
        // Activity is loaded on demand in viewOrderDetail, not eagerly here
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

  spendPointsElement.innerHTML = '';
  const fieldset = document.createElement('fieldset');
  fieldset.setAttribute('role', 'group');
  const input = document.createElement('input');
  input.id = 'pointsToSpend';
  input.type = 'number';
  input.min = '1';
  input.max = String(currentPoints);
  input.placeholder = 'Points to spend';
  input.setAttribute('aria-label', 'Points to spend');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Spend Points';
  btn.onclick = () => spendPoints();
  fieldset.appendChild(input);
  fieldset.appendChild(btn);
  const errorP = document.createElement('p');
  errorP.id = 'spendPointsError';
  errorP.style.cssText = 'color:var(--del-color);display:none;';
  spendPointsElement.appendChild(fieldset);
  spendPointsElement.appendChild(errorP);
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
  const activityContainerId = `activity-${orderId}`;

  // Toggle: if already visible, hide it
  if (detailContainer.style.display !== 'none') {
    detailContainer.style.display = 'none';
    btnElement.textContent = 'View Details';
    return;
  }

  // Cache: if already loaded, just show it
  if (detailContainer.children.length > 0) {
    detailContainer.style.display = 'block';
    btnElement.textContent = 'Hide Details';
    return;
  }

  btnElement.ariaBusy = 'true';
  btnElement.textContent = 'Loading...';

  $.ajax({
    url: `${config.ORDER_API_ENDPOINT}/orders/${orderId}`,
    method: 'GET',
    contentType: 'application/json',
    success: function(response) {
      const order = response;
      const orderDate = new Date(order.orderDate ?? order.date ?? order.created_at).toLocaleDateString();

      detailContainer.innerHTML = '';
      const hr = document.createElement('hr');
      const h4 = document.createElement('h4');
      h4.textContent = 'Order Details';
      detailContainer.appendChild(hr);
      detailContainer.appendChild(h4);

      const fields = [
        ['Order ID', order.orderId],
        ['Date', orderDate],
        ['Type', order.orderType ?? order.type ?? order.order_type ?? '—'],
        ['Status', order.orderStatus ?? order.status ?? order.order_status ?? '—'],
        ['Total Price', `$${order.totalPrice ?? order.total_price ?? '—'}`],
        ['Products', (order.products ?? []).join(', ')],
      ];
      fields.forEach(([label, value]) => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(String(value)));
        detailContainer.appendChild(p);
      });

      detailContainer.style.display = 'block';
      btnElement.ariaBusy = 'false';
      btnElement.textContent = 'Hide Details';

      // Load activity on first open
      loadOrderActivity(orderId, activityContainerId);
    },
    error: function(xhr, status, error) {
      detailContainer.style.display = 'block';
      const errP = document.createElement('p');
      errP.style.color = 'var(--del-color)';
      errP.textContent = 'Failed to load order details. Please try again.';
      detailContainer.innerHTML = '';
      detailContainer.appendChild(errP);
      btnElement.ariaBusy = 'false';
      btnElement.textContent = 'View Details';
    },
    beforeSend: function(xhr) {
      xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
    },
  });
}

function loadOrderActivity(orderId, containerId) {
  $.ajax({
    url: `${config.ACTIVITY_API_ENDPOINT}/api/activity/order/${orderId}`,
    method: 'GET',
    contentType: 'application/json',
    success: function(response) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const activities = response.activities ?? [];
      if (activities.length === 0) return;

      const details = document.createElement('details');
      details.className = 'activity-collapsible';
      const summary = document.createElement('summary');
      summary.textContent = `Activity (${activities.length})`;
      const ul = document.createElement('ul');
      activities.forEach((activity) => {
        const tsValue = activity.activity_time ?? activity.timestamp;
        const ts = new Date(tsValue).toLocaleString();
        const eventName = activity.type ?? activity.event_name ?? 'unknown';
        const li = document.createElement('li');
        li.textContent = `${eventName} — ${ts}`;
        ul.appendChild(li);
      });
      details.appendChild(summary);
      details.appendChild(ul);
      container.innerHTML = '';
      container.appendChild(details);
    },
    error: function() {
      // Activity is non-critical; silently fail
    },
  });
}

function loadUserActivity(userId) {
  $.ajax({
    url: `${config.ACTIVITY_API_ENDPOINT}/api/activity/user/${userId}`,
    method: 'GET',
    contentType: 'application/json',
    success: function(response) {
      const container = document.getElementById('userActivity');
      if (!container) return;

      const activities = response.activities ?? [];
      if (activities.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = 'font-size:0.875rem;color:var(--color-muted);font-style:italic;';
        p.textContent = 'No recent activity.';
        container.innerHTML = '';
        container.appendChild(p);
        return;
      }

      const details = document.createElement('details');
      details.className = 'activity-collapsible';
      const summary = document.createElement('summary');
      summary.textContent = `Your Activity (${activities.length})`;
      const ul = document.createElement('ul');
      activities.forEach((activity) => {
        const tsValue = activity.activity_time ?? activity.timestamp;
        const ts = new Date(tsValue).toLocaleString();
        const eventName = activity.type ?? activity.event_name ?? 'unknown';
        const li = document.createElement('li');
        li.textContent = `${eventName} — ${ts}`;
        ul.appendChild(li);
      });
      details.appendChild(summary);
      details.appendChild(ul);
      container.innerHTML = '';
      container.appendChild(details);
    },
    error: function() {
      // Activity is non-critical; silently fail
    },
  });
}

window.spendPoints = spendPoints;
window.viewOrderDetail = viewOrderDetail;
