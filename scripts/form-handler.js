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
            if (typeof WEBHOOK_URL === 'undefined' || WEBHOOK_URL === '{{WEBHOOK_URL}}' || !WEBHOOK_URL) {
                showMessage('Webhook URL is not configured. Please contact the site administrator.', 'error');
                console.error('Webhook URL not configured');
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
                // Send to webhook
                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    showMessage('Order submitted successfully! We will process your bot configuration and contact you soon.', 'success');
                    form.reset();
                    
                    // Reset form styles
                    form.querySelectorAll('input, select, textarea').forEach(field => {
                        field.style.borderColor = '';
                    });
                } else {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                showMessage('Failed to submit order. Please check your connection and try again. If the problem persists, please contact support.', 'error');
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
