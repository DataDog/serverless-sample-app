import config from "../config.js";

export function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (username.length <= 0) {
    alert("Username must not be empty");
    return;
  }

  if (password.length <= 0) {
    alert("Password must not be empty");
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.open("POST", `${config.USER_API_ENDPOINT}/login`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(
    JSON.stringify({
      email_address: username,
      password: password,
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      const response = JSON.parse(xhr.responseText);
      localStorage.setItem("jwt", response.data.token);

      const claims = parseJwt(response.data.token);
      localStorage.setItem("userType", claims.user_type);
      localStorage.setItem("userId", claims.sub);

      window.location.href = "/";
    } else {
      alert(`Login failed: ${xhr.status}`);
    }
  };
}

export function registerUser() {
  const email = document.getElementById("email").value;
  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const password = document.getElementById("registerPassword").value;

  if (email.length <= 0) {
    alert("Email must not be empty");
    return;
  }

  if (firstName.length <= 0) {
    alert("First name must not be empty");
    return;
  }

  if (lastName.length <= 0) {
    alert("Last name must not be empty");
    return;
  }

  if (password.length <= 0) {
    alert("Password must not be empty");
    return;
  }

  var xhr = new XMLHttpRequest();
  xhr.open("POST", `${config.USER_API_ENDPOINT}/user`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(
    JSON.stringify({
      email_address: email,
      first_name: firstName,
      last_name: lastName,
      password: password,
    })
  );
  xhr.onload = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      alert("Registration successful. Please log in.");
      closeModal();
    } else {
      alert(`Registration failed: ${xhr.status}`);
    }
  };
}

export function openRegisterModal() {
  document.getElementById("registerUserModal").setAttribute("open", "true");
}

export function closeModal() {
  document.getElementById("registerUserModal").removeAttribute("open");
}

window.login = login;
window.registerUser = registerUser;
window.openRegisterModal = openRegisterModal;
window.closeModal = closeModal;

function parseJwt(token) {
  try {
    // Get the payload part (second segment) of the JWT
    const base64Payload = token.split(".")[1];
    // Decode the base64 string
    const payload = atob(base64Payload);
    // Parse the JSON
    return JSON.parse(payload);
  } catch (e) {
    console.error("Error parsing JWT:", e);
    return null;
  }
}
