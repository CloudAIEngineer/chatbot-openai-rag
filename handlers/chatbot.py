import json
from utils.session import get_session, save_session
from utils.langchain import initialize_pinecone, setup_qa_chain
import os

def handler(event, context):
    user_id = event.get("userId")  # Assuming userId is passed in the event payload
    query = event.get("query")     # Query passed in the event payload

    # Retrieve previous conversation history
    session_history = get_session(user_id)

    # Initialize Pinecone and LangChain QA
    vectorstore = initialize_pinecone()
    qa_chain = setup_qa_chain(vectorstore)

    # Combine the session history with the current query
    context = session_history + "\n" + query
    result = qa_chain.invoke(context)

    # Save updated conversation history
    updated_history = session_history + "\n" + query + "\n" + result['result']
    save_session(user_id, updated_history)

    return {
        "statusCode": 200,
        "body": result['result']
    }
