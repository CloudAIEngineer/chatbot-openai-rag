from utils.session import *
from utils.langchain import initialize_pinecone, setup_qa_chain
import json

def handler(event, context):
    body = json.loads(event.get("body", "{}"))
    print("Received event body:", body)
    user_id = body.get("userId")
    query = body.get("query")

    '''If you need you may enable support of chat history
    session_history = get_chat_history(user_id)
    print("Session history:", session_history)'''

    # Initialize Pinecone and LangChain
    vectorstore = initialize_pinecone()
    chain = setup_qa_chain(vectorstore)
    
    result = chain.invoke({
        "input": query,
        "placeholder": [],
    })

    '''If you need you may enable support of chat history
    save_user_message(user_id, query)
    updated_history = save_assistant_message(user_id, result['result'])
    print("Updated after assistant:", updated_history)'''

    return {
        "statusCode": 200,
        "body": result.get("answer", "No answer available")
    }