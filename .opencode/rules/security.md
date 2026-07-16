# Security Rules

Never commit:

- API keys
- OAuth tokens
- `.env`
- customer photos
- production credentials

Sanitize filenames.
Prevent path traversal.
Restrict media access.
Do not log image data or unnecessary PII.
Protect operator controls in kiosk mode.
