import config from "./config.js";

window.DD_RUM &&
  window.DD_RUM.init({
    clientToken: config.DD_CLIENT_TOKEN,
    applicationId: config.DD_APPLICATION_ID,
    // `site` refers to the Datadog site parameter of your organization
    // see https://docs.datadoghq.com/getting_started/site/
    site: config.DD_SITE,
    service: "product-management-frontend",
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

loadComponent("header", "/header.html", () => {
  let jwt = localStorage.getItem("jwt");

  let profileElemt = document.getElementById("profile");

  if (!jwt) {
    let logoutElement = document.getElementById("logout");
    logoutElement.style.display = "none";
    profileElemt.style.display = "none";
  } else {
    let loginElement = document.getElementById("login");
    loginElement.style.display = "none";
  }
});
loadComponent("footer", "/footer.html", () => {
});

export function logout() {
  localStorage.removeItem("jwt");
  window.location.href = "/login";
}

window.logout = logout;

export function loadComponent(elementId, path, callback) {
  fetch(path)
    .then((response) => response.text())
    .then((data) => {
      document.getElementById(elementId).innerHTML = data;

      callback();
    });
}
