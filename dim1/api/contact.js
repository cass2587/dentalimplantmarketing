export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, practiceName, phone, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
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
