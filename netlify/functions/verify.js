const fetch = require("node-fetch");

exports.handler = async function (event) {
  const mySiteUrl = process.env.MY_SITE_URL || "*";
  const scoreThreshold = parseFloat(process.env.SCORE_THRESHOLD) || 0.5;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const endpointUrl = process.env.ENDPOINT_URL;

  const corsHeaders = {
    "Access-Control-Allow-Origin": mySiteUrl,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // Handle only POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  try {
    const body = JSON.parse(event.body);
    const token = body.token;

    if (!token) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: "Token is required",
      };
    }

    const verificationResponse = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${secretKey}&response=${token}`,
      }
    );

    if (!verificationResponse.ok) {
      throw new Error(`Error in ReCAPTCHA verification: ${verificationResponse.status}`);
    }

    const verificationData = await verificationResponse.json();

    if (verificationData.success && verificationData.score >= scoreThreshold) {
      const formData = body.formData;
      const formBody = new URLSearchParams(formData).toString();

      const forwardResponse = await fetch(endpointUrl, {
        method: "POST",
        body: formBody,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!forwardResponse.ok) {
        throw new Error(`Error forwarding data: ${forwardResponse.status}`);
      }

      const forwardData = await forwardResponse.json();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          formResponse: forwardData,
          threshold: scoreThreshold,
          details: verificationData,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Low ReCAPTCHA score or verification failed",
          threshold: scoreThreshold,
          details: verificationData,
        }),
      };
    }
  } catch (error) {
    console.error("Server Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
      }),
    };
  }
};
