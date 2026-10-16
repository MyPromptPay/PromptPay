
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST requests only"
    });
  }

  const {
    phoneNumber,
    amount
  } = req.body || {};

  if (
    !/^254[17]\d{8}$/.test(phoneNumber || "") ||
    !Number.isInteger(Number(amount)) ||
    Number(amount) < 1
  ) {
    return res.status(400).json({
      error: "Enter a valid Kenyan phone number and amount"
    });
  }

  const {
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_URL
  } = process.env;

  if (
    !MPESA_CONSUMER_KEY ||
    !MPESA_CONSUMER_SECRET ||
    !MPESA_SHORTCODE ||
    !MPESA_PASSKEY ||
    !MPESA_CALLBACK_URL
  ) {
    return res.status(500).json({
      error: "Payment configuration is incomplete"
    });
  }

  try {
    const credentials = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error("Daraja authentication failed");
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      MPESA_SHORTCODE + MPESA_PASSKEY + timestamp
    ).toString("base64");

    const response = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Number(amount),
          PartyA: phoneNumber,
          PartyB: MPESA_SHORTCODE,
          PhoneNumber: phoneNumber,
          CallBackURL: MPESA_CALLBACK_URL,
          AccountReference: "PromptPay",
          TransactionDesc: "PromptPay payment"
        })
      }
    );

    const data = await response.json();

    return res.status(response.ok ? 200 : 502).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "Could not initiate payment. Check server configuration."
    });
  }
};
      
