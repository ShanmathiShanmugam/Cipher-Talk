// Constants and global variables
const SERVER_URL = 'http://127.0.0.1:3000';
let currentUser = null;
let selectedUser = null;

// Debug logging utility
function debugLog(message, error = null) {
    console.log(`[DEBUG] ${message}`);
    if (error) {
        console.error(error);
    }
}

// Response validation helper
function validateResponse(response, context) {
    if (!response.ok) {
        throw new Error(`${context} failed: ${response.status} ${response.statusText}`);
    }
    return response;
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        debugLog('Starting application initialization');
        const username = localStorage.getItem('username');
        if (!username) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = username;
        await initializeApp();
    } catch (error) {
        debugLog('Error during initialization', error);
        showError('There was an error loading the application. Please refresh the page.');
    }
});

function initializeApp() {
    const chatHeader = document.querySelector('.chat-header');
    const chatInputArea = document.querySelector('.chat-input-area');
    const selectedUserPic = document.getElementById('selectedUserPic');
    const messageInput = document.createElement('textarea');
    
    // Hide chat input area and profile picture initially
    if (chatInputArea) chatInputArea.style.display = 'none';
    if (selectedUserPic) selectedUserPic.style.display = 'none';
    
    // Add message input
    messageInput.id = 'messageInput';
    messageInput.placeholder = 'Type your message...';
    if (chatInputArea) {
        chatInputArea.insertBefore(messageInput, chatInputArea.firstChild);
    }
    resetChatSection();
    setupContactListClickHandler();
    
    Promise.all([
        updateUserDisplay(),
        loadContacts()
    ]).then(() => {
        setupEventListeners();
        debugLog('Application initialized successfully');
    });
}

function setupContactListClickHandler() {
    const contactsList = document.getElementById('contactsList');
    const sidebar = document.querySelector('.sidebar');

    // Handle clicks on the contacts area background
    if (sidebar) {
        sidebar.addEventListener('click', (event) => {
            // If clicking the background of the contacts area (not a contact)
            if (event.target === sidebar || event.target === contactsList) {
                resetChatSection();
            }
        });
    }
}

// User display and profile functions
async function updateUserDisplay() {
    const usernameElement = document.getElementById('currentUsername');
    const profilePicElement = document.getElementById('userProfilePic');
    
    if (usernameElement) {
        usernameElement.textContent = currentUser;
    }
    
    if (profilePicElement) {
        await updateProfilePicture(profilePicElement, currentUser);
    }
}

async function updateProfilePicture(imgElement, username) {
    try {
        const response = await fetch(`${SERVER_URL}/api/user/${username}/profile-picture`);
        await validateResponse(response, 'Profile picture fetch');
        
        const data = await response.json();
        if (data.success) {
            imgElement.src = getFullImageUrl(data.profilePicture);
            imgElement.onerror = () => imgElement.src = 'resources/default-profile-pic.jpg';
        }
    } catch (error) {
        debugLog('Error loading profile picture', error);
        imgElement.src = 'resources/default-profile-pic.jpg';
    }
}

function getFullImageUrl(imagePath) {
    if (!imagePath) return 'resources/default-profile-pic.jpg';
    return imagePath.startsWith('http') ? imagePath : `${SERVER_URL}/${imagePath.replace(/^\//, '')}`;
}

// Contacts management
async function loadContacts() {
    try {
        const response = await fetch(`${SERVER_URL}/api/contacts`);
        await validateResponse(response, 'Contacts fetch');
        
        const contacts = await response.json();
        debugLog(`Loaded ${contacts.length} contacts`);
        
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;
        
        contactsList.innerHTML = '';
        contacts
            .filter(contact => contact.username !== currentUser)
            .forEach(contact => {
                contactsList.appendChild(createContactElement(contact));
            });
    } catch (error) {
        debugLog('Error loading contacts', error);
        showError('Failed to load contacts. Please refresh the page.');
    }
}

function createContactElement(contact) {
    const div = document.createElement('div');
    div.className = 'contact-item';
    
    const img = document.createElement('img');
    img.src = getFullImageUrl(contact.profilePicture);
    img.alt = `${contact.username}'s profile`;
    img.className = 'profile-pic';
    img.onerror = () => img.src = 'resources/default-profile-pic.jpg';

    const span = document.createElement('span');
    span.textContent = contact.username;
    
    div.append(img, span);
    div.addEventListener('click', () => selectContact(contact));
    
    return div;
}

function selectContact(contact) {
    selectedUser = contact;
    
    const selectedUsername = document.getElementById('selectedUsername');
    const selectedUserPic = document.getElementById('selectedUserPic');
    const chatHeader = document.querySelector('.chat-header');
    const chatInputArea = document.querySelector('.chat-input-area');
    
    // Show the chat header elements
    if (selectedUsername) {
        selectedUsername.textContent = contact.username;
        selectedUsername.style.display = 'block'; // Make username visible
    }
    
    if (selectedUserPic) {
        selectedUserPic.src = getFullImageUrl(contact.profilePicture);
        selectedUserPic.style.display = 'block'; // Make profile picture visible
        selectedUserPic.onerror = () => selectedUserPic.src = 'resources/default-profile-pic.jpg';
    }

    // Show chat header and adjust its styling
    if (chatHeader) {
        chatHeader.style.display = 'flex';
        chatHeader.style.justifyContent = 'flex-start'; // Align items to the left
        chatHeader.classList.add('active-chat'); // Add active chat class
    }

    // Show chat input area
    if (chatInputArea) {
        chatInputArea.style.display = 'flex';
    }
    
    loadChatHistory(contact.username);
}

// Also update the resetChatSection function to properly handle the header state
function resetChatSection() {
    selectedUser = null;
    const chatHeader = document.querySelector('.chat-header');
    const chatInputArea = document.querySelector('.chat-input-area');
    const selectedUserPic = document.getElementById('selectedUserPic');
    const selectedUsername = document.getElementById('selectedUsername');
    const chatMessages = document.getElementById('chatMessages');

    // Reset the chat area
    if (chatMessages) chatMessages.innerHTML = '';
    if (chatInputArea) chatInputArea.style.display = 'none';
    
    // Reset the header elements
    if (selectedUserPic) {
        selectedUserPic.style.display = 'none';
        selectedUserPic.src = ''; // Clear the source
    }
    
    if (selectedUsername) {
        selectedUsername.textContent = 'Select a contact to start chatting';
        selectedUsername.style.display = 'block'; // Keep the prompt visible
    }
    
    if (chatHeader) {
        chatHeader.style.display = 'flex';
        chatHeader.style.justifyContent = 'center'; // Center the prompt text
        chatHeader.classList.remove('active-chat');
    }
}
// Chat history and message handling
async function loadChatHistory(contactUsername) {
    try {
        const response = await fetch(`${SERVER_URL}/api/messages/${currentUser}/${contactUsername}`);
        await validateResponse(response, 'Chat history fetch');
        
        const messages = await response.json();
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        messages.forEach(message => displayMessage(message));
    } catch (error) {
        debugLog('Error loading chat history', error);
        showError('Failed to load chat history.');
    }
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === currentUser ? 'sent' : 'received'}`;
    
    switch (message.type) {
        case 'text':
            messageDiv.textContent = message.content;
            break;
            
        case 'encrypted':
            messageDiv.className += ' encrypted-message';
            messageDiv.textContent = message.content;
            addDecryptButton(messageDiv, message.content);
            break;
            
        case 'stego':
            const img = document.createElement('img');
            img.src = getFullImageUrl(message.content);
            img.className = 'stego-image';
            img.onerror = function() {
                debugLog('Failed to load stego image:', img.src);
                this.src = 'resources/fallback-image.png';
            };
            messageDiv.appendChild(img);
            addDecryptButton(messageDiv, message.content);
            break;
    }
    
    document.getElementById('chatMessages').appendChild(messageDiv);
}

function addDecryptButton(messageDiv, content) {
    const decryptBtn = document.createElement('button');
    decryptBtn.className = 'decrypt-button';
    decryptBtn.textContent = 'Decrypt';
    
    // Handle the decrypt button click
    decryptBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling to message
        decryptMessage(content);
    });
    
    // Handle the message click
    messageDiv.addEventListener('click', (e) => {
        // Remove active class from all other messages
        document.querySelectorAll('.message.active').forEach(msg => {
            msg.classList.remove('active');
        });
        
        // Add active class to this message
        messageDiv.classList.add('active');
        e.stopPropagation(); // Prevent event from bubbling to document
    });
    
    messageDiv.appendChild(decryptBtn);
}

// Message sending functions
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    let content = messageInput.value.trim();
    
    if (!content || !selectedUser) return;
    
    // Capitalize first letter of the message
    content = capitalizeFirstLetter(content);
    
    try {
        const response = await fetch(`${SERVER_URL}/api/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: currentUser,
                receiver: selectedUser.username,
                content,
                type: 'text'
            })
        });
        
        await validateResponse(response, 'Message send');
        messageInput.value = ''; // Clear the input after successful send
        await loadChatHistory(selectedUser.username);
        
        // Scroll to bottom after sending message
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } catch (error) {
        debugLog('Error sending message', error);
        showError('Failed to send message. Please try again.');
    }
}

function capitalizeFirstLetter(string) {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function encryptMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content || !selectedUser) return;
    
    const passkey = await promptPasskey();
    if (!passkey) return;
    
    try {
        const encrypted = CryptoJS.AES.encrypt(content, passkey).toString();
        
        const response = await fetch(`${SERVER_URL}/api/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: currentUser,
                receiver: selectedUser.username,
                content: encrypted,
                type: 'encrypted'
            })
        });
        
        await validateResponse(response, 'Encrypted message send');
        messageInput.value = '';
        await loadChatHistory(selectedUser.username);
    } catch (error) {
        debugLog('Error sending encrypted message', error);
        showError('Failed to send encrypted message. Please try again.');
    }
}

async function steganographyMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content || !selectedUser) return;
    
    const passkey = await promptPasskey();
    if (!passkey) return;
    
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    
    imageInput.click();
    
    imageInput.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('message', content);
            formData.append('passkey', passkey);
            
            const stegoResponse = await fetch(`${SERVER_URL}/api/messages/stego`, {
                method: 'POST',
                body: formData
            });
            
            await validateResponse(stegoResponse, 'Steganography processing');
            const { imageUrl } = await stegoResponse.json();
            
            const messageResponse = await fetch(`${SERVER_URL}/api/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: currentUser,
                    receiver: selectedUser.username,
                    content: imageUrl,
                    type: 'stego'
                })
            });
            
            await validateResponse(messageResponse, 'Stego message send');
            messageInput.value = '';
            await loadChatHistory(selectedUser.username);
        } catch (error) {
            debugLog('Error sending steganography message', error);
            showError('Failed to process steganography message. Please try again.');
        }
    };
}

// Encryption/Decryption utilities
async function promptPasskey() {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">Enter Passkey</div>
                    <div class="modal-body">
                        <input type="password" class="modal-input" placeholder="Enter your passkey..." />
                    </div>
                    <div class="modal-buttons">
                        <button class="modal-button secondary" data-action="cancel">Cancel</button>
                        <button class="modal-button primary" data-action="confirm">Confirm</button>
                    </div>
                </div>
            </div>
        `;

        const modalElement = createElementFromHTML(modalHtml);
        document.body.appendChild(modalElement);

        const input = modalElement.querySelector('.modal-input');
        input.focus();

        function handleModalAction(action) {
            modalElement.remove();
            if (action === 'confirm') {
                resolve(input.value);
            } else {
                resolve(null);
            }
        }

        // Handle button clicks
        modalElement.querySelectorAll('.modal-button').forEach(button => {
            button.addEventListener('click', () => {
                handleModalAction(button.dataset.action);
            });
        });

        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleModalAction('confirm');
            }
        });

        // Handle Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escapeHandler);
                handleModalAction('cancel');
            }
        });
    });
}

// Add this helper function to create elements from HTML string
function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

async function decryptMessage(content) {
    const passkey = await promptPasskey();
    if (!passkey) return;
    
    try {
        const decrypted = CryptoJS.AES.decrypt(content, passkey).toString(CryptoJS.enc.Utf8);
        if (decrypted) {
            showDecryptedMessage(decrypted);
        } else {
            showDecryptedMessage('Invalid passkey or corrupted message', true);
        }
    } catch (error) {
        showDecryptedMessage('Decryption failed. Please check your passkey.', true);
    }
}

// Add this new function to show decrypted messages
function showDecryptedMessage(message, isError = false) {
    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">${isError ? 'Error' : 'Decrypted Message'}</div>
                <div class="modal-body">
                    ${message}
                </div>
                <div class="modal-buttons">
                    <button class="modal-button primary" data-action="close">Close</button>
                </div>
            </div>
        </div>
    `;

    const modalElement = createElementFromHTML(modalHtml);
    document.body.appendChild(modalElement);

    // Handle close button click
    modalElement.querySelector('.modal-button').addEventListener('click', () => {
        modalElement.remove();
    });

    // Handle Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escapeHandler);
            modalElement.remove();
        }
    });
}

// Event listeners setup
function setupEventListeners() {
    const elements = {
        profilePicUpload: ['change', handleProfilePictureUpload],
        sendBtn: ['click', sendMessage],
        encryptBtn: ['click', encryptMessage],
        stegoBtn: ['click', steganographyMessage],
        searchInput: ['input', handleSearch],
        messageInput: ['keydown', handleMessageInputKeydown]
    };

    Object.entries(elements).forEach(([id, [event, handler]]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        }
    });

    // Add input event listener for auto-capitalization
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', handleMessageInput);
    }
    document.addEventListener('click', () => {
        // Hide all decrypt buttons by removing active class from messages
        document.querySelectorAll('.message.active').forEach(msg => {
            msg.classList.remove('active');
        });
    });
}

// Handle message input to capitalize first letter as user types
function handleMessageInput(event) {
    const input = event.target;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    
    if (input.value.length === 1) {
        input.value = input.value.toUpperCase();
        input.setSelectionRange(start, end);
    } else if (input.value.length === 0) {
        // Reset for next input
        input.setAttribute('data-empty', 'true');
    }
}

function handleMessageInputKeydown(event) {
    const messageInput = event.target;
    
    // Handle Enter key
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    } 
    // Handle new line (Shift+Enter)
    else if (event.key === 'Enter' && event.shiftKey) {
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const value = messageInput.value;
        
        // Insert new line
        messageInput.value = value.substring(0, start) + '\n' + value.substring(end);
        
        // Move cursor after new line
        messageInput.selectionStart = messageInput.selectionEnd = start + 1;
        
        event.preventDefault();
    }
}

// Profile picture upload handling
async function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePicture', file);
    formData.append('username', currentUser);

    try {
        const response = await fetch(`${SERVER_URL}/api/user/profile-picture`, {
            method: 'POST',
            body: formData
        });
        await validateResponse(response, 'Profile picture upload');

        const data = await response.json();
        if (data.success) {
            await updateUserDisplay();
            showMessage('Profile picture updated successfully!');
        } else {
            throw new Error(data.message || 'Upload failed');
        }
    } catch (error) {
        debugLog('Error uploading profile picture', error);
        showError('Failed to upload profile picture. Please try again.');
    }
}

// Search functionality
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const contactItems = document.querySelectorAll('.contact-item');
    
    contactItems.forEach(item => {
        const username = item.querySelector('span').textContent.toLowerCase();
        item.style.display = username.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Utility functions
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}