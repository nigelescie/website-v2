# eScience Website Redesign

**Apple-Style Black Background Design with Node.js Backend**

![eScience - Architects of Innovation](https://img.shields.io/badge/eScience-Architects%20of%20Innovation-00d4ff?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge)

## 🎨 Overview

Modern, premium website redesign for eScience featuring a robust Node.js backend and an Apple-style aesthetic.
- **Dynamic Content**: Managed via a secure Admin Panel.
- **Newsletter & Communication**: Automated emails powered by Nodemailer.
- **Performance**: Static file serving via Express with rate limiting.
- **Security**: JWT-based authentication for administrative tasks.

---

## 🚀 Quick Start (Local Setup)

This project requires **Node.js (v18+)** and **npm**.

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/rdagelet/escience.git
cd escience
npm install
```

### 2. Environment Configuration
Create a `.env` file from the template:
```bash
cp .env.example .env
```
Open `.env` and configure your `JWT_SECRET`, `PORT`, and **Email Credentials**. See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions on generating secrets and app passwords.

### 3. Run the Server
```bash
# Start the production server
npm start

# For development (if nodemon is installed)
node server.js
```
The website will be available at `http://localhost:3000`.

---

## 📧 Email Setup for Deployment

To enable automated welcome emails and password resets, you must configure a mail provider in your environment variables.

### Gmail (Recommended)
You must use an **App Password** (not your regular account password):
1. Enable **2-Step Verification** in your Google Account.
2. Search for **App Passwords** in your account settings.
3. Generate a password for "Mail" and "Other (Custom Name)".
4. Add the 16-character code to your `.env` or deployment dashboard as `EMAIL_PASSWORD`.

### Environment Variables
| Variable | Description |
| :--- | :--- |
| `EMAIL_SERVICE` | e.g., `gmail`, `hotmail`, `outlook` |
| `EMAIL_USER` | Your full email address |
| `EMAIL_PASSWORD` | The App Password generated above |

---

## 🌐 Deployment

### Recommended Platforms
- **Render / Heroku**: Use the `npm start` command. Ensure to set all Environment Variables in the platform's dashboard.
- **VPS (Ubuntu/Nginx)**: Use `pm2` to manage the Node process:
  ```bash
  pm2 start server.js --name "escience-web"
  ```

### Static vs. Dynamic
While the frontend is vanilla HTML/JS, it relies on the `/api` routes provided by `server.js` for subscriptions, contact forms, and admin functionality. **Do not host only the `public` folder if you need these features.**

---

## 🔐 Admin Access

The admin panel is located at `/admin`. Default credentials (if not changed) are:
- **Username**: `Admin`
- **Password**: `Escience_2026`

---

## 📁 Project Structure

- `/public` - Frontend assets (HTML, CSS, JS, Images)
- `/services` - Backend logic (Email Service)
- `/data` - JSON storage for content and subscribers
- `server.js` - Main Express server
- `.env.example` - Environment variable template

---

## 🎨 Brand Identity

- **Primary Colors**: Blue (`#005EC1`), Teal (`#46C1A4`), Purple (`#2F0475`)
- **Aesthetic**: Pure black background, glowing card effects, and smooth animations.
- **Logo**: Distinctive stacked blocks design representing growth.

## 📞 Contact

- **Email**: sales@electronicscience.net
- **Phone**: 02-8850-1324
- **Website**: [electronicscience.com](https://electronicscience.com)

---

© 2024 eScience. All rights reserved.
