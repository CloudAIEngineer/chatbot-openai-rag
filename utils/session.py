import boto3

# Get session data from DynamoDB
def get_session(user_id):
    dynamodb = boto3.client('dynamodb')
    response = dynamodb.get_item(
        TableName='ChatbotSessions',
        Key={'userId': {'S': user_id}}
    )
    return response.get('Item', {}).get('conversationHistory', {'S': ''})['S']

# Save session data to DynamoDB
def save_session(user_id, conversation_history):
    dynamodb = boto3.client('dynamodb')
    dynamodb.put_item(
        TableName='ChatbotSessions',
        Item={
            'userId': {'S': user_id},
            'conversationHistory': {'S': conversation_history}
        }
    )
