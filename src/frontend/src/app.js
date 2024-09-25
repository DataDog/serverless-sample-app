import config from './config.js';

window.DD_RUM &&
  window.DD_RUM.init({
    clientToken: config.DD_CLIENT_TOKEN,
    applicationId: config.DD_APPLICATION_ID,
    // `site` refers to the Datadog site parameter of your organization
    // see https://docs.datadoghq.com/getting_started/site/
    site: config.DD_SITE,
    service: "frontend",
    env: "dev",
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
    allowedTracingUrls: [(url) => url.startsWith("https://")],
    sessionSampleRate: 100,
    enablePrivacyForActionName: true,
});

$(document).ready(function () {
  refreshData();
});

function createProduct() {
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
  xhr.open("POST", `${config.API_ENDPOINT}/product`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(
    JSON.stringify({
      name: name,
      price: Number.parseFloat(price),
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 201) {
      refreshData();
    } else {
      console.log(`Error: ${xhr.status}`);
    }

    createBtn.ariaBusy = "false";
    createBtn.ariaLabel = "";
    createBtn.innerText = "Create";
  };
}

function deleteProduct(productId, btnElement){
  btnElement.ariaBusy = "true";
  btnElement.ariaLabel = "Deleting...";
  btnElement.innerText = "Deleting...";

  var xhr = new XMLHttpRequest();
  xhr.open("DELETE", `${config.API_ENDPOINT}/product/${productId}`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send();
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      refreshData();
    } else {
      console.log(`Error: ${xhr.status}`);
    }
  };
}

function refreshData() {
  let tableBodyElement = document.getElementById("tableBody");
  tableBodyElement.innerHTML = "";

  $.ajax({
    url: `${config.API_ENDPOINT}/product`,
    method: "GET",
    contentType: "application/json",
    success: function (response) {
      response.data.forEach((message) => {
        const productName = message.name;
        const price = message.price;

        var rowElement = document.createElement("tr");
        var nameCellElement = document.createElement("td");
        nameCellElement.innerText = productName;
        var priceCellElement = document.createElement("td");
        priceCellElement.innerText = price;

        var deleteButtonElement = document.createElement("td");
        var deleteButton = document.createElement("button");
        deleteButton.innerText = "Delete";
        deleteButton.onclick = function () {
          deleteProduct(message.productId, deleteButton);
        };
        deleteButtonElement.appendChild(deleteButton);

        rowElement.appendChild(nameCellElement);
        rowElement.appendChild(priceCellElement);
        rowElement.appendChild(deleteButtonElement);

        tableBodyElement.appendChild(rowElement);
      });
    },
    error: function (xhr, status, error) {
      alert("Login failed: " + error);
    },
  });
}
