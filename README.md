# Sentinel Bot Shop

A GitHub Pages shop for selling custom Discord bots with hosting included. This repository contains the public shop website that collects bot configuration data securely via webhook.

## Features

- Modern, responsive shop interface
- Secure form for collecting Discord bot configuration
- Step-by-step instructions for users to obtain their bot credentials
- Private webhook integration using GitHub Secrets
- Automated deployment via GitHub Actions

## Setup Instructions

### 1. Repository Setup

1. Clone this repository
2. Ensure you have a GitHub repository (can be public for GitHub Pages)

### 2. Configure GitHub Secrets

To keep your webhook URL private, you need to set up a GitHub Secret:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `WEBHOOK_URL`
5. Value: Your private webhook endpoint URL (e.g., Discord webhook URL, custom API endpoint, etc.)
6. Click **Add secret**

**Important:** The webhook URL will be injected into the site during the GitHub Actions build process. It will never appear in your repository or commit history.

### 3. Deploy to GitHub Pages

1. Push your code to the `main` or `master` branch
2. Go to **Settings** → **Pages** in your repository
3. Under **Source**, select **GitHub Actions**
4. The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically:
   - Inject the `WEBHOOK_URL` secret into `scripts/config.js`
   - Deploy the site to GitHub Pages

### 4. Test the Deployment

1. After deployment, visit your GitHub Pages URL
2. Navigate to the order form
3. Fill out a test order (use test credentials)
4. Verify that the webhook receives the data

## Project Structure

```
sentinel-shop/
├── index.html              # Shop landing page
├── order.html              # Order form with instructions
├── styles/
│   └── main.css           # Main stylesheet
├── scripts/
│   ├── config.template.js # Template with placeholder (safe to commit)
│   └── form-handler.js   # Form validation and submission
├── bot/
│   └── (your bot code)   # Bot template codebase
├── .github/
│   └── workflows/
│       └── deploy.yml     # GitHub Actions deployment workflow
├── bot.env.example        # Example bot configuration
└── .gitignore            # Excludes sensitive files
```

## How It Works

1. **User visits the shop** → Sees landing page with product information
2. **User clicks "Order Now"** → Goes to order form
3. **User reads instructions** → Step-by-step guide for Discord Developer Portal
4. **User fills form** → Enters bot configuration and customer info
5. **Form submits** → Data sent to your private webhook endpoint
6. **You receive data** → Process the order and provision the bot

## Security

- **Webhook URL**: Stored in GitHub Secrets, never in the repository
- **Form Data**: Sent directly to your webhook, never stored in the repository
- **Generated Files**: `scripts/config.js` is in `.gitignore` and never committed
- **HTTPS**: GitHub Pages provides automatic HTTPS

## Local Development

For local development, the form will use a placeholder webhook URL. To test:

1. Create a local `scripts/config.js` file (this is gitignored):
   ```javascript
   const WEBHOOK_URL = 'http://localhost:3000/webhook'; // Your test endpoint
   ```

2. Serve the files using a local server (e.g., `python -m http.server` or `npx serve`)

3. Test the form submission

**Note:** Never commit `scripts/config.js` - it should only exist locally or in the deployed GitHub Pages site.

## Customization

- **Styling**: Edit `styles/main.css` to match your brand
- **Content**: Modify `index.html` and `order.html` for your shop content
- **Bot Template**: Add your bot codebase to the `bot/` directory
- **Form Fields**: Adjust form fields in `order.html` as needed

## Support

For issues or questions, please open an issue in this repository.

## License

[Add your license here]
