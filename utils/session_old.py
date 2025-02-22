import boto3
import json

def get_session(user_id):
    dynamodb = boto3.client('dynamodb', region_name='eu-central-1')
    response = dynamodb.get_item(
        TableName='ChatbotSessions',
        Key={'userId': {'S': user_id}}
    )
    session_history = response.get('Item', {}).get('conversationHistory', {'S': '[]'})['S']
    return json.loads(session_history)

def save_session(user_id, conversation_history):
    dynamodb = boto3.client('dynamodb', region_name='eu-central-1')
    dynamodb.put_item(
        TableName='ChatbotSessions',
        Item={
            'userId': {'S': user_id},
            'conversationHistory': {'S': json.dumps(conversation_history)}
        }
    )

def add_user_message(session_history, query):
    return session_history + [{"role": "user", "content": query}]

def add_assistant_message(session_history, response):
    return session_history + [{"role": "assistant", "content": response}]