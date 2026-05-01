export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, practiceName, phone, email, message, 'cf-turnstile-response': turnstileToken } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    if (!turnstileToken) {
        return res.status(400).json({ error: 'Turnstile verification failed (missing token)' });
    }

    const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
    if (!TURNSTILE_SECRET_KEY) {
        console.error('Missing TURNSTILE_SECRET_KEY environment variable');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify Turnstile token
    try {
        const formData = new URLSearchParams();
        formData.append('secret', TURNSTILE_SECRET_KEY);
        formData.append('response', turnstileToken);

        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });

        const verifyResult = await verifyResponse.json();

        if (!verifyResult.success) {
            console.error('Turnstile verification failed:', verifyResult);
            return res.status(400).json({ error: 'Turnstile verification failed' });
        }
    } catch (error) {
        console.error('Error verifying Turnstile:', error);
        return res.status(500).json({ error: 'Turnstile verification error' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
        console.error('Missing BREVO_API_KEY environment variable');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify({
                sender: { email: "noreply@manifestyourmedia.com", name: "Website Contact Form" },
                to: [{ email: "cassidy@manifestyourmedia.com", name: "Cassidy Torrey" }],
                subject: `New Lead: ${name} from ${practiceName || 'Unknown Practice'}`,
                htmlContent: `
                    <h2>New Strategy Session Request</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Practice Name:</strong> ${practiceName || 'Not provided'}</p>
                    <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <br/>
                    <h3>Message:</h3>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                `
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Brevo API Error:', errorText);
            throw new Error('Failed to send email via Brevo');
        }

        return res.status(200).json({ success: true, message: 'Lead submitted successfully' });
    } catch (error) {
        console.error('Contact Form Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
