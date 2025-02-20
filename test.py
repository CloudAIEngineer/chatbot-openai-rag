import json
from handlers.chatbot import handler

event = {
    "body": json.dumps({
        "userId": "user_123",
        "query": "What is the capital of France?"
    })
}

response = handler(event, None)
print(response)
