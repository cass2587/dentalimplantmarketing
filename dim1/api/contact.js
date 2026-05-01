export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const { name, practiceName, phone, email, message } = body;
    const turnstileToken = body['cf-turnstile-response'];

    console.log('=== Contact Form Submission ===');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Has Turnstile Token:', !!turnstileToken);

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    // --- Turnstile Verification (optional - log but don't block) ---
    const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
    let turnstileVerified = false;

    if (turnstileToken && TURNSTILE_SECRET_KEY) {
        try {
            const formData = new URLSearchParams();
            formData.append('secret', TURNSTILE_SECRET_KEY);
            formData.append('response', turnstileToken);

            const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                body: formData,
            });

            const verifyResult = await verifyResponse.json();
            turnstileVerified = verifyResult.success;
            console.log('Turnstile verification result:', JSON.stringify(verifyResult));

            if (!verifyResult.success) {
                console.warn('Turnstile verification failed but proceeding anyway:', verifyResult);
            }
        } catch (error) {
            console.error('Error verifying Turnstile:', error.message);
        }
    } else {
        console.warn('Turnstile skipped - Token present:', !!turnstileToken, 'Secret key present:', !!TURNSTILE_SECRET_KEY);
    }

    // --- Send Email via Brevo ---
    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
        console.error('FATAL: Missing BREVO_API_KEY environment variable');
        return res.status(500).json({ error: 'Server configuration error: missing API key' });
    }

    // Sanitize inputs to prevent HTML injection
    const sanitize = (str) => str ? str.replace(/[<>]/g, '') : '';

    const emailPayload = {
        sender: { email: "cassidy@manifestyourmedia.com", name: "Manifest Media Website" },
        to: [{ email: "cassidy@manifestyourmedia.com", name: "Cassidy Torrey" }],
        replyTo: { email: sanitize(email), name: sanitize(name) },
        subject: `New Lead: ${sanitize(name)} from ${sanitize(practiceName) || 'Unknown Practice'}`,
        htmlContent: `
            <h2>New Strategy Session Request</h2>
            <table style="border-collapse:collapse;width:100%;max-width:600px;">
                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Name</td><td style="padding:8px;border:1px solid #ddd;">${sanitize(name)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Practice</td><td style="padding:8px;border:1px solid #ddd;">${sanitize(practiceName) || 'Not provided'}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${sanitize(phone) || 'Not provided'}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;">${sanitize(email)}</td></tr>
            </table>
            ${message ? '<br/><h3>Message:</h3><p>' + sanitize(message).replace(/\n/g, '<br>') + '</p>' : ''}
            <br/><hr/>
            <p style="font-size:12px;color:#888;">Turnstile verified: ${turnstileVerified ? 'Yes' : 'No'}</p>
            <p style="font-size:12px;color:#888;">Submitted at: ${new Date().toISOString()}</p>
        `
    };

    console.log('Sending email via Brevo...');
    console.log('Sender:', JSON.stringify(emailPayload.sender));
    console.log('To:', JSON.stringify(emailPayload.to));
    console.log('Subject:', emailPayload.subject);

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify(emailPayload)
        });

        const responseText = await response.text();
        console.log('Brevo response status:', response.status);
        console.log('Brevo response body:', responseText);

        if (!response.ok) {
            console.error('Brevo API Error:', response.status, responseText);
            return res.status(500).json({ 
                error: 'Failed to send email',
                details: `Brevo returned ${response.status}`
            });
        }

        console.log('=== Email sent successfully ===');
        return res.status(200).json({ success: true, message: 'Lead submitted successfully' });
    } catch (error) {
        console.error('Contact Form Error:', error.message);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
