# Environment Setup for eScience

This guide helps you configure the necessary environment variables to get the eScience Node.js server running correctly.

## Quick Start

1.  **Copy `.env.example` to `.env`**:
    ```bash
    cp .env.example .env
    ```

2.  **Generate a secure JWT secret**:
    You can use this command to generate a 64-character hex string:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
    Add this to your `JWT_SECRET` in `.env`.

3.  **Configure Email Credentials**:
    Follow the steps below to enable email functionality (welcome emails, password resets).

## Email Configuration (Nodemailer)

The website uses `nodemailer` to send automated emails. By default, it's configured for **Gmail**, but other providers can be used.

### Using Gmail (Recommended for testing)

For Gmail to work with apps, you MUST use an **App Password** (2-Step Verification must be enabled):

1.  Log in to your [Google Account](https://myaccount.google.com/).
2.  Go to **Security** > **2-Step Verification**.
3.  Scroll to the bottom and select **App Passwords**.
4.  Enter a name (e.g., "eScience Website") and click **Create**.
5.  Copy the generated **16-character password**.
6.  Update your `.env` file:
    ```env
    EMAIL_SERVICE=gmail
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASSWORD=your-app-password-here
    ```

### Using Other Email Services

If you use another provider like Outlook or Yahoo, update `EMAIL_SERVICE` accordingly (e.g., `hotmail`, `yahoo`). For custom SMTP, you may need to modify `services/emailService.js`.

## Required Environment Variables

| Variable | Description | Recommended Value |
| :--- | :--- | :--- |
| `EMAIL_SERVICE` | Email provider service name | `gmail` |
| `EMAIL_USER` | Your email address | `example@gmail.com` |
| `EMAIL_PASSWORD` | App-specific password | *(See instructions above)* |
| `JWT_SECRET` | Secret key for authentication | *(Unique random string)* |
| `PORT` | Local server port | `3000` |
| `NODE_ENV` | Running environment | `development` or `production` |

## Security & Deployment

- ⚠️ **DO NOT commit `.env` to Git**: It's already in `.gitignore`.
- **Deployment**: On platforms like Render or Vercel, don't use a `.env` file; instead, add these variables in the **Environment Variables** section of the dashboard.
