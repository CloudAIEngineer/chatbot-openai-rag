import boto3
import os
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory

# Table name to store chat sessions
SESSION_TABLE_NAME = os.environ.get('SESSION_TABLE_NAME')

# Create a boto3 session
boto3_session = boto3.Session(region_name=os.environ.get('AWS_REGION'))

def create_history(user_id):
    """
    Helper function to create a DynamoDBChatMessageHistory object.
    """
    return DynamoDBChatMessageHistory(
        table_name=SESSION_TABLE_NAME,
        session_id=user_id,
        boto3_session=boto3_session,
        primary_key_name='userId',
        history_size=5
    )

def get_chat_history(user_id):
    history = create_history(user_id)
    for msg in history.messages:
        print(type(msg), msg)
    return history.messages if history.messages else []

def save_user_message(user_id, query):
    history = create_history(user_id)
    history.add_user_message(query)
    return history

def save_assistant_message(user_id, response):
    history = create_history(user_id)
    history.add_ai_message(response)
    return history