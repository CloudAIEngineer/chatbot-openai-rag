export const handler = async (event) => {
    try {
      const body = JSON.parse(event.body || "{}");
      const userMessage = body.message?.trim();
  
      if (!userMessage) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing 'message' field in request body" }),
        };
      }
  
      // Simple mock responses
      const cannedReplies = [
        "That's an interesting question!",
        "Let me think... Okay, here's what I found.",
        "According to our policy, it's quite simple.",
        "Good question — usually it works like this.",
        "Sure! You can do that directly from your account page.",
        "Please contact support for detailed instructions.",
        "It depends on your location, but typically yes.",
        "Absolutely! That’s covered under the basic plan.",
        "No worries, I can help you with that.",
        "Here’s a quick summary: everything will be fine.",
      ];
  
      const randomReply = cannedReplies[Math.floor(Math.random() * cannedReplies.length)];
  
      const response = {
        reply: randomReply,
        userMessage,
        timestamp: new Date().toISOString(),
      };
  
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      };
    } catch (err) {
      console.error("Mock chatbot error:", err);
      return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
    }
  };
  