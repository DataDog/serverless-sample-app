let jwt = "";

$(document).ready(function () {
  jwt = localStorage.getItem("jwt");
  let user_type = localStorage.getItem("userType");

  if (!jwt) {
    window.location.href = "/login";
  }

  if (user_type !== "ADMIN") {
    window.location.href = "/";
  }
});
