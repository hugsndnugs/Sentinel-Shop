# Bot Template

This directory contains your bot template codebase.

## Configuration

The bot uses environment variables for configuration. See `../bot.env.example` for the required configuration values:

- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_CLIENT_SECRET` - Your Discord OAuth2 client secret
- `DISCORD_REDIRECT_URI` - OAuth2 redirect URI
- `LOG_LEVEL` - Optional logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `BOT_STATUS` - Optional bot status message

## Adding Your Bot Code

1. Add your bot source files to this directory
2. Ensure your bot reads configuration from environment variables (matching `bot.env.example`)
3. Update this README with any specific setup instructions for your bot

## Order Processing

When customers submit orders through the shop form, you will receive their bot configuration data via webhook. Use this data to:

1. Create a `.env` file (or set environment variables) with the customer's configuration
2. Deploy/provision the bot instance using your bot template
3. Set up hosting for the bot instance

## Example Structure

```
bot/
├── README.md          # This file
├── main.py           # Your bot entry point (example)
├── requirements.txt  # Python dependencies (if applicable)
├── package.json      # Node.js dependencies (if applicable)
└── ...               # Other bot files
```
