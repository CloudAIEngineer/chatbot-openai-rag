# Use an official AWS Lambda Python base image
FROM public.ecr.aws/lambda/python:3.11

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the necessary files
COPY handlers/ /app/handlers/
COPY utils/ /app/utils/

# Set the PYTHONPATH to include /app
ENV PYTHONPATH="/app"

# Set the Lambda function entry point
CMD ["handlers.chatbot.handler"]

ENTRYPOINT ["/lambda-entrypoint.sh"]