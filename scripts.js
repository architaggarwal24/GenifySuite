



document.getElementById('card-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const cardNumber = document.getElementById('card-number').value;
    const result = document.getElementById('result');
    const cardType = document.getElementById('card-type');
    

    if (validateLuhn(cardNumber)) {
        // cardType.textcontent = "Card Type: " + $getCardType(cardNumber);
        result.innerHTML = `<div><div><span class="icon">✅</span><strong>The credit card number is VALID!</strong></div>
        <div> Card Type: <strong>${getCardType(cardNumber)}</strong></div></div>`;
        result.className = "result-box valid"; // Apply green box
        
    } else {
        result.innerHTML = `<span class="icon">❌</span><strong>The credit card number is INVALID!</strong>`;
        cardType.textContent = "";
        result.className = "result-box invalid"; // Apply red box
    }
});
// Function to validate credit card using Luhn algorithm
function validateLuhn(cardNumber) {
    let sum = 0;
    let shouldDouble = false;

    // Loop through card number digits from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber[i]);

        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        shouldDouble = !shouldDouble;
    }

    // Valid card number if sum is a multiple of 10
    return sum % 10 === 0;
}

// Function to determine card type based on card number
function getCardType(cardNumber) {
    const firstDigit = cardNumber.charAt(0);
    const firstTwoDigits = cardNumber.slice(0, 2);
    const firstFourDigits = cardNumber.slice(0, 4);

    if (firstDigit === '4') {
        return "Visa";
    } else if (firstTwoDigits === '34' || firstTwoDigits === '37') {
        return "American Express";
    } else if (['51', '52', '53', '54', '55'].includes(firstTwoDigits)) {
        return "MasterCard";
    } else if (firstFourDigits === '6011' || cardNumber.slice(0, 3) === '644' || firstTwoDigits === '65') {
        return "Discover";
    } else if (firstFourDigits === '3528' || (parseInt(firstTwoDigits) >= 35 && parseInt(firstTwoDigits) <= 39)) {
        return "JCB";
    } else if (['22', '23', '24', '25', '26', '27'].includes(firstTwoDigits)) {
        return "MasterCard (New Range)";
    } else if (firstTwoDigits === '60') {
        return "RuPay";
    } else {
        return "Unknown";
    }
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Automatically set the current year in the footer
document.getElementById('current-year').textContent = new Date().getFullYear();


function generateProfiles() {
const gender = document.getElementById('gender').value;
const quantity = document.getElementById('quantity').value;

const url = `https://randomuser.me/api/?results=${quantity}&gender=${gender !== 'random' ? gender : ''}`;

fetch(url)
    .then(response => response.json())
    .then(data => {
        displayProfiles(data.results);
    })
    .catch(error => {
        console.error('Error fetching random users:', error);
    });
}

function displayProfiles(users) {
const profilesContainer = document.getElementById('profiles-container');
profilesContainer.innerHTML = '';

users.forEach(user => {
    const profileCard = document.createElement('div');
    profileCard.classList.add('bg-[#1e2a38]', 'text-white', 'shadow-lg', 'rounded-lg', 'p-6', 'max-w-sm', 'mx-auto');

    profileCard.innerHTML = `
        <div class="text-center">
            <img class="w-24 h-24 rounded-full mx-auto mb-4" src="${user.picture.large}" alt="${user.name.first} ${user.name.last}">
            <h2 class="text-2xl text-white font-bold">${user.name.title} ${user.name.first} ${user.name.last}</h2>
        </div>
        <div class="mt-4 text-left">
            <p><i class="fas fa-user"></i> <strong>Username:</strong> ${user.login.username}</p>
            <p><i class="fas fa-lock"></i> <strong>Password:</strong> ${user.login.password}</p>
            <p><i class="fas fa-envelope"></i> <strong>Email:</strong> ${user.email}</p>
            <p><i class="fas fa-venus-mars"></i> <strong>Gender:</strong> ${user.gender}</p>
            <p><i class="fas fa-birthday-cake"></i> <strong>Date of Birth:</strong> ${new Date(user.dob.date).toLocaleDateString()}</p>
            <p><i class="fas fa-phone"></i> <strong>Phone Number:</strong> ${user.phone}</p>
            <p><i class="fas fa-mobile-alt"></i> <strong>Cell Number:</strong> ${user.cell}</p>
            <p><i class="fas fa-map-marker-alt"></i> <strong>Address:</strong> ${user.location.street.number} ${user.location.street.name}, ${user.location.city}, ${user.location.state}, ${user.location.country} ${user.location.postcode}</p>
            <p><i class="fas fa-flag"></i> <strong>Country:</strong> ${user.location.country}</p>
        </div>
    `;

    profilesContainer.appendChild(profileCard);
});
}






//////////////////////////////////////////////////////////////////////////////////////////////////////////////




function checkDetails() {
const ip = document.getElementById("ipAddress").value.trim();

// Validate IP address
if (!ip) {
    document.getElementById("result").innerHTML = "<p class='error'>Please enter a valid IP address.</p>";
    return;
}

// Fetch IP location data from ip-api.com
fetch(`http://ip-api.com/json/${ip}`)
.then(response => response.json())
.then(data => {
    if (data.status === "fail") {
        document.getElementById("result").innerHTML = `<p class='error'>Error: ${data.message}</p>`;
    } else {
        // Display the fetched details in sections
        document.getElementById("result").innerHTML = `
            <div class="ip-details">
                <div class="section">
                    <span class="label">IP Address</span>
                    <span class="value">${data.query}</span>
                </div>
                <div class="section">
                    <span class="label">Country</span>
                    <span class="value">${data.country}</span>
                </div>
                <div class="section">
                    <span class="label">Country Code</span>
                    <span class="value">${data.countryCode}</span>
                </div>
                <div class="section">
                    <span class="label">Region</span>
                    <span class="value">${data.regionName}</span>
                </div>
                <div class="section">
                    <span class="label">City</span>
                    <span class="value">${data.city}</span>
                </div>
                <div class="section">
                    <span class="label">Latitude</span>
                    <span class="value">${data.lat}</span>
                </div>
                <div class="section">
                    <span class="label">Longitude</span>
                    <span class="value">${data.lon}</span>
                </div>
                <div class="section">
                    <span class="label">ISP</span>
                    <span class="value">${data.isp}</span>
                </div>
            </div>
        `;
    }
})
.catch(error => {
    document.getElementById("result").innerHTML = "<p class='error'>Unable to fetch data. Please try again later.</p>";
});
}



