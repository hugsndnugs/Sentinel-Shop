// Form handler for Discord bot order form
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('botOrderForm');
    const formMessage = document.getElementById('formMessage');
    const instructionsToggle = document.getElementById('instructionsToggle');
    const instructionsContent = document.getElementById('instructionsContent');

    // Toggle instructions section
    if (instructionsToggle && instructionsContent) {
        instructionsToggle.addEventListener('click', function() {
            const isExpanded = instructionsToggle.getAttribute('aria-expanded') === 'true';
            instructionsContent.style.display = isExpanded ? 'none' : 'block';
            instructionsToggle.setAttribute('aria-expanded', !isExpanded);
        });
    }

    // Help icon toggles
    const helpIcons = document.querySelectorAll('.help-icon');
    helpIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const helpType = this.getAttribute('data-help');
            const helpContent = document.getElementById(`help-${helpType}`);
            if (helpContent) {
                const isVisible = helpContent.style.display === 'block';
                helpContent.style.display = isVisible ? 'none' : 'block';
            }
        });
    });

    // Form validation
    function validateForm() {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.style.borderColor = '#ED4245';
            } else {
                field.style.borderColor = '';
            }
        });

        // Validate email format
        const emailField = document.getElementById('customerEmail');
        if (emailField && emailField.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailField.value)) {
                isValid = false;
                emailField.style.borderColor = '#ED4245';
            }
        }

        // Validate Discord token format (basic check - should start with alphanumeric)
        const tokenField = document.getElementById('discordToken');
        if (tokenField && tokenField.value) {
            if (tokenField.value.length < 50) {
                isValid = false;
                tokenField.style.borderColor = '#ED4245';
                showMessage('Discord token appears to be invalid. Please check and try again.', 'error');
                return false;
            }
        }

        // Validate Client ID (should be numeric)
        const clientIdField = document.getElementById('discordClientId');
        if (clientIdField && clientIdField.value) {
            if (!/^\d+$/.test(clientIdField.value)) {
                isValid = false;
                clientIdField.style.borderColor = '#ED4245';
                showMessage('Client ID should be numeric. Please check and try again.', 'error');
                return false;
            }
        }

        // Validate redirect URI format
        const redirectUriField = document.getElementById('discordRedirectUri');
        if (redirectUriField && redirectUriField.value) {
            try {
                new URL(redirectUriField.value);
            } catch (e) {
                isValid = false;
                redirectUriField.style.borderColor = '#ED4245';
                showMessage('Redirect URI must be a valid URL. Please check and try again.', 'error');
                return false;
            }
        }

        return isValid;
    }

    // Show message to user
    function showMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`;
        formMessage.style.display = 'block';
        
        // Scroll to message
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Validate form
            if (!validateForm()) {
                showMessage('Please fill in all required fields correctly.', 'error');
                return;
            }

            // Check if webhook URL is configured
            if (typeof WEBHOOK_URL === 'undefined' || WEBHOOK_URL === '{{WEBHOOK_URL}}' || !WEBHOOK_URL || window.CONFIG_LOAD_ERROR) {
                showMessage('Webhook URL is not configured. Please contact the site administrator. If you are the administrator, check that the GitHub Secret WEBHOOK_URL is set and the deployment completed successfully.', 'error');
                console.error('Webhook URL not configured. WEBHOOK_URL:', typeof WEBHOOK_URL !== 'undefined' ? WEBHOOK_URL : 'undefined');
                return;
            }

            // Disable submit button
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';

            // Collect form data
            const formData = {
                customerName: document.getElementById('customerName').value.trim(),
                customerEmail: document.getElementById('customerEmail').value.trim(),
                orderNotes: document.getElementById('orderNotes').value.trim(),
                discordToken: document.getElementById('discordToken').value.trim(),
                discordClientId: document.getElementById('discordClientId').value.trim(),
                discordClientSecret: document.getElementById('discordClientSecret').value.trim(),
                discordRedirectUri: document.getElementById('discordRedirectUri').value.trim(),
                logLevel: document.getElementById('logLevel').value || 'INFO',
                botStatus: document.getElementById('botStatus').value.trim() || 'Watching over servers',
                timestamp: new Date().toISOString()
            };

            try {
                // Format data for Discord webhook
                // Discord webhooks expect either 'content' (text) or 'embeds' (rich content)
                // We'll use embeds for better formatting
                const discordPayload = {
                    embeds: [{
                        title: '🤖 New Bot Order',
                        color: 0x5865F2, // Discord blurple color
                        fields: [
                            {
                                name: '👤 Customer Information',
                                value: `**Name:** ${formData.customerName}\n**Email:** ${formData.customerEmail}`,
                                inline: false
                            },
                            {
                                name: '🔑 Discord Bot Token',
                                value: `\`\`\`${formData.discordToken.substring(0, 20)}...\`\`\``,
                                inline: false
                            },
                            {
                                name: '🆔 Client ID',
                                value: formData.discordClientId,
                                inline: true
                            },
                            {
                                name: '🔐 Client Secret',
                                value: `\`\`\`${formData.discordClientSecret.substring(0, 20)}...\`\`\``,
                                inline: true
                            },
                            {
                                name: '🔗 Redirect URI',
                                value: formData.discordRedirectUri,
                                inline: false
                            },
                            {
                                name: '⚙️ Log Level',
                                value: formData.logLevel,
                                inline: true
                            },
                            {
                                name: '📝 Bot Status',
                                value: formData.botStatus,
                                inline: true
                            }
                        ],
                        timestamp: formData.timestamp,
                        footer: {
                            text: 'Sentinel Bot Shop'
                        }
                    }]
                };

                // Add order notes if provided
                if (formData.orderNotes) {
                    discordPayload.embeds[0].fields.push({
                        name: '📋 Order Notes',
                        value: formData.orderNotes,
                        inline: false
                    });
                }

                // Add full configuration data as a code block for easy copying
                // This will be in a separate field that you can easily copy
                const configData = {
                    DISCORD_TOKEN: formData.discordToken,
                    DISCORD_CLIENT_ID: formData.discordClientId,
                    DISCORD_CLIENT_SECRET: formData.discordClientSecret,
                    DISCORD_REDIRECT_URI: formData.discordRedirectUri,
                    LOG_LEVEL: formData.logLevel,
                    BOT_STATUS: formData.botStatus
                };
                
                // Format as .env file format for easy copying
                const envFormat = Object.entries(configData)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('\n');
                
                discordPayload.embeds[0].fields.push({
                    name: '📄 Full Configuration (.env format)',
                    value: `\`\`\`\n${envFormat}\`\`\``,
                    inline: false
                });
                
                // Also add as JSON for programmatic use
                discordPayload.embeds[0].fields.push({
                    name: '📦 JSON Format',
                    value: `\`\`\`json\n${JSON.stringify(configData, null, 2)}\`\`\``,
                    inline: false
                });

                // Send to Discord webhook
                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(discordPayload)
                });

                if (response.ok) {
                    showMessage('Order submitted successfully! We will process your bot configuration and contact you soon.', 'success');
                    form.reset();
                    
                    // Reset form styles
                    form.querySelectorAll('input, select, textarea').forEach(field => {
                        field.style.borderColor = '';
                    });
                } else {
                    // Get error details from response if available
                    let errorMessage = `Server responded with status: ${response.status}`;
                    try {
                        const errorData = await response.text();
                        if (errorData) {
                            errorMessage += ` - ${errorData.substring(0, 100)}`;
                        }
                    } catch (e) {
                        // Ignore if we can't read the response
                    }
                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                console.error('Webhook URL:', WEBHOOK_URL ? 'Set' : 'Not set');
                console.error('Error details:', error.message);
                
                // Provide more specific error messages
                let userMessage = 'Failed to submit order. ';
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    userMessage += 'Network error - please check your internet connection. ';
                } else if (error.message.includes('CORS')) {
                    userMessage += 'CORS error - the webhook endpoint may not allow requests from this domain. ';
                } else if (error.message.includes('status: 404')) {
                    userMessage += 'Webhook endpoint not found (404). Please verify the webhook URL is correct. ';
                } else if (error.message.includes('status: 401') || error.message.includes('status: 403')) {
                    userMessage += 'Authentication failed. Please verify the webhook URL is correct. ';
                } else if (error.message.includes('status: 500')) {
                    userMessage += 'Server error on webhook endpoint. Please try again later. ';
                } else {
                    userMessage += `Error: ${error.message}. `;
                }
                userMessage += 'If the problem persists, please contact support.';
                
                showMessage(userMessage, 'error');
            } finally {
                // Re-enable submit button
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }

    // Clear error styling on input
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            this.style.borderColor = '';
        });
    });
});
