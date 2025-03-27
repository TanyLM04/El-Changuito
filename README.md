# El Changuito - E-commerce Platform

A Node.js e-commerce platform with PayPal integration, featuring both user and developer modes.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- PayPal Developer Account (for sandbox testing)

## Dependencies

- express
- mongoose
- ejs
- express-session
- paypal-rest-sdk

1. Install dependencies:

npm install


2. Set up MongoDB:
   - Make sure MongoDB is installed on your system
   - Start the MongoDB service
   - The application will connect to `mongodb://localhost:27017/elchanguito`

2. Configure PayPal:
   - Sign up for a PayPal Developer account at https://developer.paypal.com
   - Create a sandbox application to get your API credentials
   - Update the PayPal configuration in `index.js` with your sandbox credentials:

   paypal.configure({
     mode: "sandbox",
     client_id: "YOUR_CLIENT_ID",
     client_secret: "YOUR_CLIENT_SECRET"
   });

## Running the Application

1. Start the server:

node index.js

2. Open your browser and navigate to:

http://localhost:5000


## Switching Modes

1. Click the profile icon in the top-right corner
2. Select "Profile" from the dropdown menu
3. Choose between "User Mode" or "Developer Mode
