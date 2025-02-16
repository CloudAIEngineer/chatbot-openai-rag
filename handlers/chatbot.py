from utils.session import *
from utils.langchain import initialize_pinecone, setup_qa_chain

def handler(event, context):
    user_id = event.get("userId")
    query = event.get("query")

    session_history = get_session(user_id)

    # Initialize Pinecone and LangChain
    vectorstore = initialize_pinecone()
    qa_chain = setup_qa_chain(vectorstore)

    # Add the user's message to the thread and get response
    updated_history = add_user_message(session_history, query)
    result = qa_chain.invoke(updated_history)

    # Add the assistant's response to the session history
    updated_history = add_assistant_message(updated_history, result['result'])
    save_session(user_id, updated_history)

    return {
        "statusCode": 200,
        "body": result['result']
    }