// Get references to buttons, forms, title, image, modals, and modal buttons
const registerButton = document.getElementById('registerButton');
const loginButton = document.getElementById('loginButton');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const goBackRegister = document.getElementById('goBackRegister');
const goBackLogin = document.getElementById('goBackLogin');
const goBackProfileButton = document.getElementById('goBackProfileButton');
const pageTitle = document.getElementById('pageTitle');
const titleImage = document.getElementById('titleImage');
const warningModal = document.getElementById('warningModal');
const changeButton = document.getElementById('changeButton');
const okayButton = document.getElementById('okayButton');
const successModal = document.getElementById('successModal');
const continueLoginButton = document.getElementById('continueLoginButton');
const profilePicWarningModal = document.getElementById('profilePicWarningModal');
const profilePicOkayButton = document.getElementById('profilePicOkayButton');
const profilePicturePage = document.getElementById('profilePicturePage');
const skipButton = document.getElementById('skipButton');
const continueButton = document.getElementById('continueButton');
const profilePictureInput = document.getElementById('profilePictureInput');

let registrationData = {};

// Event listeners for the register, login, and go back buttons
registerButton.addEventListener('click', () => {
    clearRegistrationForm();
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
    registerButton.style.display = 'none';
    loginButton.style.display = 'none';
    titleImage.style.display = 'none';
    pageTitle.textContent = "Register to the Chat Platform";
});

loginButton.addEventListener('click', () => {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    registerButton.style.display = 'none';
    loginButton.style.display = 'none';
    titleImage.style.display = 'none';
    pageTitle.textContent = "Welcome Back";
});

// Modified login form submission handler
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            alert("Username and Password cannot be empty.");
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include',
            });

            const data = await response.json();

            if (response.ok) {
                // Store username in localStorage for contacts page
                localStorage.setItem('username', username);
                // Update the redirect path to use the correct path to contacts.html
                window.location.href = '/client/contacts.html';
            } else {
                alert(data.message || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('An error occurred during login. Please try again.');
        }
    });
}
goBackRegister.addEventListener('click', (e) => {
    e.preventDefault();
    redirectToHomePage();
});

goBackLogin.addEventListener('click', (e) => {
    e.preventDefault();
    redirectToHomePage();
});

goBackProfileButton.addEventListener('click', () => {
    profilePicturePage.style.display = 'none';
    registerForm.style.display = 'flex';
    pageTitle.textContent = "Register to the Chat Platform";
});

// Form submission for registration
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const passkey = document.getElementById('registerPasskey').value.trim();

        if (!username || !password || !passkey) {
            alert("Username, Password, and Passkey cannot be empty.");
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/check-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
                credentials: 'include',
            });

            const data = await response.json();

            if (!data.success) {
                alert(data.message);
                return;
            }

            registrationData = { username, password, passkey };
            warningModal.style.display = 'block';
        } catch (error) {
            console.error('Error checking username:', error);
            alert('An error occurred while checking the username. Please try again.');
        }
    });
}

// Modal button event listeners
changeButton.addEventListener('click', () => {
    warningModal.style.display = 'none';
});

okayButton.addEventListener('click', () => {
    warningModal.style.display = 'none';
    profilePicturePage.style.display = 'block';
    registerForm.style.display = 'none';
    successModal.style.display = 'none';
});

// Profile picture upload or skip
skipButton.addEventListener('click', () => {
    completeRegistration('resources/Default.jpg');
    showSuccessModal();
    redirectToHomePage();
});

continueButton.addEventListener('click', () => {
    const file = profilePictureInput.files[0];

    if (!file) {
        profilePicWarningModal.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('profilePicture', file);
    formData.append('username', registrationData.username);
    formData.append('password', registrationData.password);
    formData.append('passkey', registrationData.passkey);

    fetch('http://localhost:3000/complete-registration', {
        method: 'POST',
        body: formData,
        credentials: 'include',
    })
    .then(res => res.json())
    .then(data => {
        handleSuccessfulRegistration();
    })
    .catch(err => {
        console.error('Error during registration:', err);
        handleSuccessfulRegistration();
    });
});

// Function to display the success modal
function showSuccessModal() {
    successModal.style.display = 'block';
}

// Modified handleSuccessfulRegistration function
function handleSuccessfulRegistration() {
    localStorage.setItem('registered', 'true');
    clearRegistrationForm();
    redirectToHomePage();
    showSuccessModal();
}   

function completeRegistration(profilePicture) {
    const { username, password, passkey } = registrationData;

    console.log('Attempting to complete registration for user:', username);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('passkey', passkey);
    formData.append('profilePicture', profilePicture);

    fetch('http://localhost:3000/complete-registration', {
        method: 'POST',
        body: formData,
        credentials: 'include',
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.message || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Registration successful');
            handleSuccessfulRegistration();
        } else {
            throw new Error(data.message || 'Unknown registration error');
        }
    })
    .catch(error => {
        console.error('Error during registration:', error);
        alert(`Registration failed: ${error.message}. Please try again.`);
    });
}

// Success modal logic
window.addEventListener('load', () => {
    if (localStorage.getItem('registered') === 'true') {
        showSuccessModal();
        localStorage.removeItem('registered');
    }
});

// Modified event listener for continueLoginButton
continueLoginButton.addEventListener('click', () => {
    successModal.style.display = 'none';
    redirectToHomePage();
});

window.onclick = function(event) {
    if (event.target === profilePicWarningModal) {
        profilePicWarningModal.style.display = 'none';
    }
};

profilePicOkayButton.addEventListener('click', () => {
    profilePicWarningModal.style.display = 'none';
});

// Modified function to redirect to the home page
function redirectToHomePage() {
    clearRegistrationForm();
    registerForm.style.display = 'none';
    loginForm.style.display = 'none';
    registerButton.style.display = 'inline-block';
    loginButton.style.display = 'inline-block';
    titleImage.style.display = 'block';
    pageTitle.textContent = "Welcome to the Chat Platform";
    profilePicturePage.style.display = 'none';
}

// New function to clear the registration form
function clearRegistrationForm() {
    if (registerForm) {
        document.getElementById('registerUsername').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerPasskey').value = '';
    }
    registrationData = {};
}